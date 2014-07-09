/**
 * Stretto EditableDocumentFormatter
 * Adds a mouse and keyboard UI to Vex.Flow.DocumentFormatter.Liquid
 * @author Albert Armea (aarmea)
 */

Stretto.EditableDocumentFormatter = function() {
  Vex.Flow.DocumentFormatter.Liquid.apply(this, arguments);
}

Stretto.EditableDocumentFormatter.prototype = new Vex.Flow.DocumentFormatter.Liquid;
Stretto.EditableDocumentFormatter.prototype.constructor = Stretto.EditableDocumentFormatter;

Stretto.EditableDocumentFormatter.prototype.drawPart =
function(part, vfStaves, context) {
  // Direct paste from Vex.Flow.DocumentFormatter.drawPart to get its variables
  // Begin paste
  var staves = part.getStaves();
  var voices = part.getVoices();

  vfStaves.forEach(function(stave) { stave.setContext(context).draw(); });

  var allVfObjects = new Array();
  var vfVoices = new Array();
  voices.forEach(function(voice) {
    var result = this.getVexflowVoice(voice, vfStaves);
    Array.prototype.push.apply(allVfObjects, result[1]);
    var vfVoice = result[0];
    var lyricVoice = result[2];
    vfVoice.tickables.forEach(function(tickable) {
      tickable.setStave(vfVoice.stave); });
    vfVoices.push(vfVoice);
    if (lyricVoice) {
      lyricVoice.tickables.forEach(function(tickable) {
        tickable.setStave(lyricVoice.stave); });
      vfVoices.push(lyricVoice);
    }
  }, this);
  var formatter = new Vex.Flow.Formatter().joinVoices(vfVoices);
  formatter.format(vfVoices, vfStaves[0].getNoteEndX()
                             - vfStaves[0].getNoteStartX() - 10);
  var i = 0;
  vfVoices.forEach(function(vfVoice) {
    vfVoice.draw(context, vfVoice.stave); });
  allVfObjects.forEach(function(obj) {
    obj.setContext(context).draw(); });
  // End paste

  // Create and populate the appropriate quadtrees
  var canvasIndex = parseInt(context.canvas.id.substr(13));
  if (!(canvasIndex in this.quadtrees)) {
    this.quadtrees[canvasIndex] = new Quadtree({
      x: 0,
      y: 0,
      width: context.canvas.width,
      height: context.canvas.height
    });
  }

  for (var voiceNo = 0; voiceNo < vfVoices.length; voiceNo++) {
    var vfVoice = vfVoices[voiceNo];
    var voice = voices[voiceNo];

    // Sometimes voices don't have corresponding notes. For example, lyrics.
    // Skip over these voices.
    // TODO: Make lyrics clickable (probably need to fix lyrics rendering first)
    if (typeof voice === "undefined") continue;

    for (var tickNo = 0; tickNo < vfVoice.tickables.length; tickNo++) {
      var tickable = vfVoice.tickables[tickNo];
      var note = voice.notes[tickNo];

      var box = tickable.getBoundingBox();
      if (box) {
        this.quadtrees[canvasIndex].insert({
          x: box.x,
          y: box.y,
          width: box.w,
          height: box.h,
          vfObj: tickable,
          obj: note
        });
      }
    }
  }
}

Stretto.EditableDocumentFormatter.prototype.draw = function(elem, options) {
  if (this._htmlElem != elem) {
    this.quadtrees = [];
  }

  Vex.Flow.DocumentFormatter.Liquid.prototype.draw.apply(this, arguments);

  // Attach input event handlers
  this.canvases.forEach(function(canvas) {
    canvas.addEventListener("click", this, false);
  }, this);
}

Stretto.EditableDocumentFormatter.prototype.getObjectsAtLocation =
function(clickEvent) {
  var canvasIndex = parseInt(clickEvent.toElement.id.substr(13));
  var pos = {
    x: clickEvent.offsetX / this.zoom,
    y: clickEvent.offsetY / this.zoom
  };
  var rawResults = this.quadtrees[canvasIndex].retrieve({
    x: pos.x,
    y: pos.y,
    width: 1,
    height: 1
  });

  var results = Array();
  rawResults.forEach(function(rawResult) {
    var resultPoly = new SAT.Box(new SAT.Vector(rawResult.x, rawResult.y),
      rawResult.width, rawResult.height).toPolygon();
    var point = new SAT.Vector(pos.x, pos.y);
    if (SAT.pointInPolygon(point, resultPoly)) {
      results.push(rawResult.obj);
    }
  });
  return results;
}

Stretto.EditableDocumentFormatter.prototype.handleEvent = function(event) {
  var canvasIndex = parseInt(event.toElement.id.substr(13));
  switch (event.type) {
    case 'click':
      console.log(this.getObjectsAtLocation(event)); // XXX
      break;
  }
}
