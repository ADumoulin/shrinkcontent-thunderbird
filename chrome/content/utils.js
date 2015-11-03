"use strict";

/*
	------ Various utility functions ------
*/

/*
 	a simple buffered input stream reading line by line
*/

function InputStreamReader(stream,buffersize) {
	this.buffersize = buffersize;
	this.data = [];
	this.pos = 0;
	this.stream = stream;
	this.nextLine = "";
	this.BLANK_LINE = "!__BLANK__!";
}

InputStreamReader.prototype.init = function() {
	this.stream.available();
	this.data = this.stream.available() ? this.stream.read(this.buffersize) : [];
};

InputStreamReader.prototype.hasNextLine = function() {
	var buffersize = this.buffersize;
	var data = this.data;
	var pos = this.pos;
	var stream = this.stream;
	var nextLine = this.nextLine;
	var noData = data.length > 0;

	if (nextLine.length>0) {
		return true; // don't move position before line has been retrieved
	}
	if (pos < data.length) {
		var nextPos = pos;
		// read until next line feed
		while (data.charAt(nextPos) != '\n') {
			nextPos++;
			if (nextPos == data.length) {
				nextLine += data.substring(pos,nextPos);
				pos = 0;
				nextPos = 0;
				if (stream.available()) {
					data = stream.read(buffersize);
				}
				else {
					data = [];
					break;
				}
			}
		}
		if (nextPos > pos) {
			nextLine += data.substring(pos,nextPos);
		}
		pos = nextPos + 1;
		if (pos == data.length) {
			pos = 0;
			data =  stream.available() ? data = stream.read(buffersize) : [];
		}
		this.nextLine = nextLine.replace(/\r/g,'');
		if (this.nextLine.length == 0) {
			this.nextLine = this.BLANK_LINE;
		}
		this.pos = pos;
		this.data = data;
		return true;
	}
	else {
		return false;
	}
};

InputStreamReader.prototype.readLine = function() {
	var line = this.nextLine;
	if (line == this.BLANK_LINE) {
		line = "";
	}
	this.nextLine = "";
	return line;
};

InputStreamReader.prototype.close = function() {
	this.data = null;
	this.stream.close();
};

/*
 	a simple buffered output stream writer
*/

function OutputStreamWriter(stream,buffersize,lineEnd) {
	this.stream = stream;
	this.buffersize = buffersize;
	this.lineEnd = lineEnd;
	this.data = "";
}

OutputStreamWriter.prototype.writeLine = function(line) {
	this.data += line + this.lineEnd;
	if (this.data.length >= this.buffersize) {
		this.stream.write(this.data,this.buffersize);
		this.data = this.data.substring(this.buffersize,this.data.length);
	}
};

OutputStreamWriter.prototype.writeLines = function(lines) {
	if (lines) {
		for (var i=0;i<lines.length;i++) {
			this.data += lines[i] + this.lineEnd;
		}
		if (this.data.length >= this.buffersize) {
			this.stream.write(this.data,this.buffersize);
			this.data = this.data.substring(this.buffersize,this.data.length);
		}
	}
};

OutputStreamWriter.prototype.close = function() {
	this.stream.write(this.data,this.data.length);
	this.data = null;
	this.stream.close();
};

/*
	decoding functions for standard mime encoding
*/
function decode(encoding,data) {
	var decodedData = "";
	if (!encoding) {
		throw "No encoding specified for mime decoding";
	}
	encoding = encoding.toLowerCase();
	if (encoding == "base64") {
		decodedData = window.atob(data);
	}
	else if (encoding == "quoted-printable") {
		decodedData = data.replace(/\s+[\r|\n]/g,'') // remove trailing white spaces
						   .replace(/=\r\n/g,'') 	 // remove soft line breaks
						   .replace(/=([a-fA-F0-9]{2})/g, function($0, $1) {
						   		// encode decimal point
						   		return String.fromCharCode(parseInt($1, 16)); });
	}
	else if (encoding == "7bit" || encoding == "8bit" || encoding == "none") {
		decodedData = data; // nothing to decode
	}
	else {
		throw (encoding + " encoding cannot be decoded");
	}
	return decodedData;
}

function decodeString(data,charset) {
	var buf = new ArrayBuffer(data.length);
	var bufView = new Uint8Array(buf);
	for (var i=0;i<data.length; i++) {
		bufView[i] = data.charCodeAt(i);
	}
	return new TextDecoder(charset).decode(bufView);
}

function decodeMimeWord(word) {
	var decodedWord = word;
	try {
		var charsetMatch = word.match(/\?([^\?]+)\?([BQ])\?([^\?]+)\?=/i);
		if (charsetMatch) {
			// decode using base encoding
			var charset = charsetMatch[1].toLowerCase();
			if (charsetMatch[2] == "B") { // filename encoded in base 64
				word = decode("base64",charsetMatch[3]);
			}
			else if (charsetMatch[2] == "Q") { // filename encoded in quoted-printable
				word = decode("quoted-printable",charsetMatch[3]);
			}
			word = decodeString(word,charset);
		}
	}
	catch(ex) {
		// ignore
	}
	return word;
}

/*
	returns a human readable file size
*/
function humanReadableSize(bytes) {
  if (bytes == 0) { return "0.00B"; }
  var e = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes/Math.pow(1024, e)).toFixed(2)+'bkmgtp'.charAt(e)+(e >0 ? 'B' : '');
}
