// Our MusicXML parser is heavily based on (and contains significant snippets
// from) the one in ringw's fork of VexFlow with MusicXML support (see
// https://github.com/ringw/vexflow/blob/musicxml/src/musicxml.js).  However, to
// make implementing editing easier, we parse the entire document at once
// instead of at render time.

Stretto.Serialization.MusicXML = function() {
  this.partList = new Array();
  this.staveConnectors = new Array();
  // Create timewise array of arrays
  // Measures (zero-indexed) -> array of <measure> elements for each part
  this.measuresXML = new Array();
  this.measures = new Array();
  // Actual measure number for each measure
  // (Usually starts at 1, or 0 for pickup measure, and numbers consecutively)
  this.measureNumbers = new Array();
  // Store number of staves for each part (zero-indexed)
  this.numStaves = new Array();
  // Track every child of any <attributes> element in array
  // (except <staves> which is stored in numStaves)
  // Measures -> parts ->
  //  object where keys are names of child elements ->
  //    data representing the attribute
  this.attributes = new Array();
}

Stretto.Serialization.MusicXML.prototype.load = function(data) {
  this.parse(data);
  this.parseMeasures();
}

/**
 * Parses the metadata, such as title and part list, of a MusicXML score.
 * @param {String/DOM object} MusicXML document as a string or DOM document
 */
Stretto.Serialization.MusicXML.prototype.parse = function(data) {
  if (typeof data == "string") {
    // Parse XML string
    if (window.DOMParser && typeof XMLDocument != "undefined") {
      var parser = new window.DOMParser();
      this.document = parser.parseFromString(data, "text/xml");
    }
    else if (window.ActiveXObject
             && new window.ActiveXObject("Microsoft.XMLDOM")) {
      this.document = new window.ActiveXObject("Microsoft.XMLDOM");
      this.document.async = "false";
      this.document.loadXML(data);
    }
    else throw new Vex.RERR("UnsupportedBrowserError", "No XML parser found");
  }
  else if (data instanceof Document) this.document = data;
  else {
    this.valid = false;
    throw new Vex.RERR("ArgumentError",
                       "MusicXML requires XML string or DOM Document object");
  }
  this.documentElement = this.document.documentElement;
  if (this.documentElement.nodeName != 'score-partwise')
    throw new Vex.RERR("ArgumentError",
                       "Stretto only supports partwise scores");

  // Go through each part, pushing the measures on the correct sub-array
  var partNum = 0;
  Array.prototype.forEach.call(this.documentElement.childNodes, function(node){
    if (node.nodeName == "part-list") this.parsePartList(node);
    else if (node.nodeName == "part") {
      var measureNum = 0;
      for (var j = 0; j < node.childNodes.length; j++) {
        var measure = node.childNodes[j];
        if (measure.nodeName != "measure") continue;
        if (! (measureNum in this.measuresXML))
          this.measuresXML[measureNum] = new Array();
        if (this.measuresXML[measureNum].length != partNum) {
          // Some part is missing a measure
          Vex.LogFatal("Part missing measure");
          this.valid = false;
          return;
        }
        if (! (measureNum in this.measureNumbers)) {
          var num = parseInt(measure.getAttribute("number"));
          if (! isNaN(num)) this.measureNumbers[measureNum] = num;
        }
        this.measuresXML[measureNum][partNum] = measure;
        var attributes = measure.getElementsByTagName("attributes")[0];
        if (attributes) this.parseAttributes(measureNum, partNum, attributes);
        measureNum++;
      }
      // numStaves defaults to 1 for this part
      if (! (partNum in this.numStaves))
        this.numStaves[partNum] = 1;
      partNum++;
    }
  }, this);

  // Create a brace for each part with multiple staves
  var partNum = 0;
  this.numStaves.forEach(function(staves) {
    if (staves > 1) this.staveConnectors.push({
      type: "brace", parts: [partNum], system_start: true});
    partNum++;
  }, this);

  this.valid = true;
}

Stretto.Serialization.MusicXML.prototype.parseMeasures = function() {
  // TODO: Implement - parse the measures contained in this.measuresXML
  for (var i = 0; i < this.measuresXML.length; i++) {
    this.measures.push(this.getMeasure(i));
  }
}

Stretto.Serialization.MusicXML.prototype.parsePartList = function(partListElem) {
  // We only care about stave connectors in part groups
  var partNum = 0;
  var partGroup = null;
  var staveConnectors = null; // array of stave connectors for part group
  Array.prototype.forEach.call(partListElem.childNodes, function(elem) {
    switch (elem.nodeName) {
      case "part-group":
        if (elem.getAttribute("type") == "start") {
          partGroup = [];
          staveConnectors = [];
          Array.prototype.forEach.call(elem.childNodes, function(groupElem) {
            switch (groupElem.nodeName) {
              case "group-symbol":
                if (groupElem.textContent == "bracket"
                    || groupElem.textContent == "brace")
                  // Supported connectors
                  staveConnectors.push({type: groupElem.textContent,
                                        system_start: true});
              case "group-barline":
                if (groupElem.textContent == "yes")
                  staveConnectors.push({type: "single", measure_start: true,
                                        system_end: true});
            }
          });
        }
        else if (elem.getAttribute("type") == "stop") {
          staveConnectors.forEach(function(connect) {
            connect.parts = partGroup;
            this.staveConnectors.push(connect);
          }, this);
          partGroup = staveConnectors = null;
        }
        break;
      case "score-part":
        if (partGroup) partGroup.push(partNum);
        this.partList.push(partNum);
        partNum++;
        break;
    }
  }, this);
}

Stretto.Serialization.MusicXML.prototype.parseAttributes =
  function(measureNum, partNum, attributes) {
  var attrs = attributes.childNodes;
  for (var i = 0; i < attrs.length; i++) {
    var attrObject = null;
    var attr = attrs[i];
    switch (attr.nodeName) {
      case "staves":
        // If this is the first measure, we use <staves>
        if (measureNum == 0)
          this.numStaves[partNum] = parseInt(attr.textContent);
        break;
      case "key":
        attrObject = this.fifthsToKey(parseInt(attr.getElementsByTagName(
                                                 "fifths")[0].textContent));
        break;
      case "time":
        attrObject = (attr.getElementsByTagName("senza-misura").length > 0)
                   ? {num_beats: 4, beat_value: 4, soft: true}
                   : {
          num_beats: parseInt(attr.getElementsByTagName("beats")[0]
                                      .textContent),
          beat_value: parseInt(attr.getElementsByTagName(
                                          "beat-type")[0].textContent),
          soft: true // XXX: Should we always have soft voices?
        };
        break;
      case "clef":
        var number = parseInt(attr.getAttribute("number"));
        var sign = attr.getElementsByTagName("sign")[0].textContent;
        var line = parseInt(attr.getElementsByTagName("line")[0].textContent);
        var clef = (sign == "G" && line == "2") ? "treble"
                 : (sign == "C" && line == "3") ? "alto"
                 : (sign == "C" && line == "4") ? "tenor"
                 : (sign == "F" && line == "4") ? "bass"
                 : null;
        if (number > 0) {
          if (measureNum in this.attributes
              && partNum in this.attributes[measureNum]
              && this.attributes[measureNum][partNum].clef instanceof Array)
            attrObject = this.attributes[measureNum][partNum].clef;
          else attrObject = new Array(this.numStaves[partNum]);
          attrObject[number - 1] = clef;
        }
        else attrObject = clef;
        break;
      case "divisions":
        attrObject = parseInt(attr.textContent);
        break;
      default: continue; // Don't use attribute if we don't know what it is
    }
    if (! (measureNum in this.attributes))
      this.attributes[measureNum] = [];
    if (! (partNum in this.attributes[measureNum]))
      this.attributes[measureNum][partNum] = {};
    this.attributes[measureNum][partNum][attr.nodeName] = attrObject;
  }
  return attrObject;
}

/**
 * Converts keys as fifths (e.g. -2 for Bb) to the equivalent major key ("Bb").
 * @param {Number} number of fifths from -7 to 7
 * @return {String} string representation of key
 */
Stretto.Serialization.MusicXML.prototype.fifthsToKey = function(fifths) {
  // Find equivalent key in Vex.Flow.keySignature.keySpecs
  for (var i in Vex.Flow.keySignature.keySpecs) {
    var spec = Vex.Flow.keySignature.keySpecs[i];
    if (typeof spec != "object" || ! ("acc" in spec) || ! ("num" in spec))
      continue;
    if (   (fifths < 0 && spec.acc == "b" && spec.num == Math.abs(fifths))
        || (fifths >= 0 && spec.acc != "b" && spec.num == fifths)) return i;
  }
}

Stretto.Serialization.MusicXML.prototype.getMeasure = function(m) {
  var measure_attrs = this.getAttributes(m, 0);
  var time = measure_attrs.time;
  var measure = new Vex.Flow.Measure({time: time});
  var numParts = this.measuresXML[m].length;
  measure.setNumberOfParts(numParts);
  for (var p = 0; p < numParts; p++) {
    var attrs = this.getAttributes(m, p);
    var partOptions = {time: time};
    if (typeof attrs.clef == "string") partOptions.clef = attrs.clef;
    if (typeof attrs.key  == "string") partOptions.key  = attrs.key;
    measure.setPart(p, partOptions);
    var part = measure.getPart(p);
    part.setNumberOfStaves(this.numStaves[p]);
    if (attrs.clef instanceof Array)
      for (var s = 0; s < this.numStaves[p]; s++)
        part.setStave(s, {clef: attrs.clef[s]});
    var numVoices = 1; // can expand dynamically
    var noteElems = this.measuresXML[m][p].getElementsByTagName("note");
    var voiceObjects = new Array(); // array of arrays
    var lastNote = null; // Hold on to last note in case there is a chord
    for (var i = 0; i < noteElems.length; i++) {
      // FIXME: Chord support
      var noteObj = this.parseNote(noteElems[i], attrs);
      if (noteObj.grace) continue; // grace note requires VexFlow support
      var voiceNum = 0;
      if (typeof noteObj.voice == "number") {
        if (noteObj.voice >=numVoices) part.setNumberOfVoices(noteObj.voice+1);
        voiceNum = noteObj.voice;
      }
      var voice = part.getVoice(voiceNum);
      if (voice.notes.length == 0 && typeof noteObj.stave == "number") {
        // TODO: voice spanning multiple staves (requires VexFlow support)
        voice.stave = noteObj.stave;
      }
      if (noteObj.chord) lastNote.keys.push(noteObj.keys[0]);
      else {
        if (lastNote) part.getVoice(lastNote.voice || 0).addNote(lastNote);
        lastNote = noteObj;
      }
    }
    if (lastNote) part.getVoice(lastNote.voice || 0).addNote(lastNote);
    // Voices appear to not always be consecutive from 0
    // Copy part and number voices correctly
    // FIXME: Figure out why this happens
    var newPart = new Vex.Flow.Measure.Part(part);
    var v = 0; // Correct voice number
    for (var i = 0; i < part.getNumberOfVoices(); i++)
      if (typeof part.getVoice(i) == "object"
          && part.getVoice(i).notes.length > 0) {
        newPart.setVoice(v, part.getVoice(i));
        v++;
      }
    newPart.setNumberOfVoices(v);
    measure.setPart(p, newPart);
  }
  return measure;
}

/**
 * Returns complete attributes object for measure m, part p (zero-indexed)
 */
Stretto.Serialization.MusicXML.prototype.getAttributes = function(m, p) {
  var attrs = {};
  // Merge with every previous attributes object in order
  // If value is an array, merge non-null indices only
  for (var i = 0; i <= m; i++) {
    if (! (i in this.attributes)) continue;
    if (! (p in this.attributes[i])) continue;
    var measureAttrs = this.attributes[i][p];
    for (key in measureAttrs) {
      var val = measureAttrs[key];
      if (val instanceof Array) {
        if (! (attrs[key] && attrs[key] instanceof Array))
          attrs[key] = [];
        for (var ind = 0; ind < val.length; ind++)
          if (typeof attrs[key][ind] == "undefined"
              || (typeof val[ind] != "undefined" && val[ind] != null))
            attrs[key][ind] = val[ind];
      }
      else attrs[key] = val;
    }
  }

  // Default attributes
  if (! attrs.time) attrs.time = {num_beats: 4, beat_value: 4, soft: true};

  return attrs;
}
