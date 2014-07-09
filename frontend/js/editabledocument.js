/**
 * Stretto EditableDocument
 * Adds an editing API to Vex.Flow.Document
 * @author Albert Armea (aarmea)
 */

Stretto.EditableDocument = function(data) {
  Vex.Flow.Document.apply(this, arguments);

  // Force loading every measure into the internal representation
  for (var i = 0; i < this.measures.length; i++) {
    this.getMeasure(i);
  }
}

// Stretto.EditableDocument inherits Vex.Flow.Document
Stretto.EditableDocument.prototype = new Vex.Flow.Document;
Stretto.EditableDocument.prototype.constructor = Stretto.EditableDocument;

// TODO: Create an editing API here
