/**
 * Shrink Message Content Thunderbird Plugin
 *
 * @copyright Copyright(c) 2015 Antoine Dumoulin
 * @author Antoine Dumoulin <dumoulinantoine@hotmail.com>
 * @license GPL v3
 *
 * This extension uses a good chunk of code from the excellent Header Tools Lite extension
 */

"use strict";

var ShrinkContent = {
	READY_STATUS: 0,
	RUNNING_STATUS: 1,
	CANCEL_STATUS: 2,
	status: 0,
	boolOptionNames: [
		"header_removeReceived",
		"header_removeExtras",
		"header_removeSignatures",
		"removeSignature",
		"removeEmbeddedContent",
		"removeQuotedMessages",
		"removeAttachments",
		"moveToTrash",
		"saveAttachment"
	],
	intOptionNames: [
		"maxQuoteLines"
	],
	stringOptionNames: [
		"alternativeTextType"
	],
	complexOptionNames: [
		[ "attachmentFolder",Components.interfaces.nsILocalFile,"removeAttachments" ]
	],
	options: {},
	messageEnumerator: new MessageEnumerator(),
	pendingDeletions: { "folder": null, "messages": Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray) },
	tempDir: null,
	notifyUpdate:function(result){},
	notifyFinish:function(result){},
	prefs: Services.prefs.getBranch("extensions.shrinkcontent."),
	startup: function()
 	{
 		ShrinkContent.prefs.addObserver("", this, false);
		// recreate temporary directory to make sure it is empty
		ShrinkContent.tempDir = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("TmpD", Components.interfaces.nsIFile);
		ShrinkContent.tempDir.append("shrinkcontent");
		if (ShrinkContent.tempDir.exists()) {
			ShrinkContent.tempDir.remove(true);
		}
		ShrinkContent.tempDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE,parseInt("0775",8));
 	},
 	retrieveOptions: function() {
		for (var i=0;i<ShrinkContent.boolOptionNames.length;i++) {
			ShrinkContent.options[ShrinkContent.boolOptionNames[i]] = ShrinkContent.prefs.getBoolPref(ShrinkContent.boolOptionNames[i]);
		}
		for (var i=0;i<ShrinkContent.intOptionNames.length;i++) {
			ShrinkContent.options[ShrinkContent.intOptionNames[i]] = ShrinkContent.prefs.getIntPref(ShrinkContent.intOptionNames[i]);
		}
		for (var i=0;i<ShrinkContent.stringOptionNames.length;i++) {
			ShrinkContent.options[ShrinkContent.stringOptionNames[i]] = ShrinkContent.prefs.getCharPref(ShrinkContent.stringOptionNames[i]);
		}
		for (var i=0;i<ShrinkContent.complexOptionNames.length;i++) {
			if (ShrinkContent.options[ShrinkContent.complexOptionNames[i][2]]) {
				ShrinkContent.options[ShrinkContent.complexOptionNames[i][0]] = ShrinkContent.prefs.getComplexValue(ShrinkContent.complexOptionNames[i][0],ShrinkContent.complexOptionNames[i][1]);
			}
		}
	},
 	shrinkMessages: function(selection,numberSelected,isFolder) {
		ShrinkContent.retrieveOptions();
		ShrinkContent.status = ShrinkContent.RUNNING_STATUS;
		var result = { 
			"numberSelected": numberSelected,
			"processed":0,
			"succeed":0,
			"initialSize":0,
			"finalSize":0,
			"errors":[]
		};
		ShrinkContent.messageEnumerator.init(selection,isFolder);
		ShrinkContent.shrinkNextMessage(result);
 	},
	shrinkNextMessage: function(result) {
		if (ShrinkContent.status == ShrinkContent.CANCEL_STATUS || !ShrinkContent.messageEnumerator.hasNext()) {
			// done or cancelled
			ShrinkContent.status = ShrinkContent.READY_STATUS;
			ShrinkContent.messageEnumerator.close();
			ShrinkContent.processDeletion(null,true); // force pending deletions
			ShrinkContent.notifyFinish(result);
			return;
		}
		result["processed"]++;
		ShrinkContent.notifyUpdate(result);
		var msgHdr = ShrinkContent.messageEnumerator.next();
		// create a temporary file
		var tempFile = ShrinkContent.tempDir.clone();
		tempFile.append("shrinkcontent_temp.eml");
		tempFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE,parseInt("0600", 8));
		try {
			var outStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
			outStream.init(tempFile, 2, 0x02 | 0x20, false); // write and truncate flags
			// get stream from message
			var messageURI = msgHdr.folder.getUriForMsg(msgHdr);
			var msgService = messenger.messageServiceFromURI(messageURI);
			var msgStream = Components.classes["@mozilla.org/network/sync-stream-listener;1"].createInstance();
			var scriptInput = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance();
			var inStream = scriptInput.QueryInterface(Components.interfaces.nsIScriptableInputStream);
			inStream.init(msgStream);
			msgService.streamMessage(messageURI,msgStream,null, null, false, null);
			//  -- main call : process message --
			var initialSize = msgHdr.messageSize;
			ShrinkContent.processMessage(inStream,outStream);
			var finalSize = tempFile.fileSize;
			// create message from temp file and clean up
			var list = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
			list.appendElement(msgHdr, false);
			var fileSpec = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			fileSpec.initWithPath(tempFile.path);
			// copy message
			Components.classes["@mozilla.org/messenger/messagecopyservice;1"].getService(Components.interfaces.nsIMsgCopyService)
			.CopyFileMessage(fileSpec, msgHdr.folder, null, false, msgHdr.flags, msgHdr.getStringProperty("keywords"),
				{ OnStopCopy: function (status) { ShrinkContent.messageDone(tempFile,msgHdr,result,initialSize,finalSize,status); } }, msgWindow);
		}
		catch(ex) {
			result["processed"]++;
			result["errors"].push(ShrinkContent.errorMessage(msgHdr,ex));
			tempFile.remove(false);
		}
	},
	processMessage: function(inStream, outStream) {
		var options = ShrinkContent.options;
		var streamParser = new InputStreamReader(inStream,1024);
		streamParser.init();
		var streamWriter = new OutputStreamWriter(outStream,1024,'\r\n');
		var attachmentStream = null;
		try {
			var content = "";
			var newBlock = function() {
				return {
					"id":"-",
					"type":"",
					"subtype":"",
					"inHeader":true,
					"boundaryId":"",
					"skipAll":false,
					"isAttachment":false,
					"storeContent": false,
					"encoding":"",
					"charset":"",
					"filename":"",
					"contentTypeLine":-1,
					"quotesNumber":0,
					"headerContent":[],
					"content":[],
					"parentBlock":null
				};
			}
			var block = newBlock();
			var blocks = [ block ];
			var nextLine = streamParser.hasNextLine() ? streamParser.readLine() : null;
			while (nextLine != null) {
				var line = nextLine;
				var skip = false;
				nextLine = streamParser.hasNextLine() ? streamParser.readLine() : null;
				if (line.length == 0) {
					if (block["inHeader"]) { // Header done parsing
						block["inHeader"] = false;
						ShrinkContent.processCompleteHeader(block,options,streamWriter);
					}
				}
				// parse header
				if (block["inHeader"]) {
					// concatenate multiline fields
					if (nextLine !=null && nextLine.match(/^\s+/)) {
						nextLine = line + "\r\n" + nextLine;
						continue;
					}
					skip = ShrinkContent.processHeader(line,block,options);
					if (!skip) {
						block["headerContent"].push(line);
					}
				}
				// parse block content
				else {
					// concatenate multiline fields for quoted-printable
					if (block["encoding"] == "quoted-printable" && line.endsWith("=") && nextLine !=null) {
						nextLine = line + "\r\n" + nextLine;
						continue;
					}
					skip = block["skipAll"];
					// Block beginning or end
					var isBlockLimit = false;
					var isEnd = false;
					var beginBlockMatch = line.match(/^--(.*)/);
					if (beginBlockMatch) {
						var id = beginBlockMatch[1];
						if (id.endsWith("--")) { // potential end
							isEnd = true;
							id = id.substring(0,id.length-2);
						}
						var parentBlockIndex = -1;
						for (var i=0;i<blocks.length;i++) {
							if (blocks[i]["boundaryId"] == id){
								parentBlockIndex = i;
								break;
							}
						}
						if (parentBlockIndex != -1) {
							isBlockLimit = true;
							if (isEnd) {
								[ block, skip ] = ShrinkContent.processBlockEnd(id,block,blocks,options,streamWriter);
							}
							else {
								[ block, skip ] = ShrinkContent.processBlockBeginning(id,blocks[parentBlockIndex],line,block,blocks,newBlock);
							}
						}
						// close attachment stream when reaching the end of a block
						if (isBlockLimit && attachmentStream) {
	 						attachmentStream.close();
	 						attachmentStream = null;
	 					}
					}
					// Test if attachment needs to be saved to a file
					if (block["isAttachment"] && options["saveAttachment"] && options["attachmentFolder"] && block["subtype"] != "x-moz-deleted" && !isBlockLimit) {
						if (!attachmentStream) {
							attachmentStream = ShrinkContent.createAttachmentFileStream(options["attachmentFolder"],block);
						}
						var decodedLine =  decode(block["encoding"],line); // decode mime encoding
						attachmentStream.writeLine(decodedLine);
					}
					if (!skip) {
						[ skip, line ] = ShrinkContent.processTextBody(line,block,options);
					}
					if (!skip) {
						if (block["storeContent"]) {
							block["content"].push(line);
						}
						else {
							streamWriter.writeLine(line);
						}
					}
				}
			}
		}
		finally {
			streamParser.close();
			streamWriter.close();
			if (attachmentStream) {
				attachmentStream.close();
			}
		}
	},
	processHeader: function(line,block,options) {
		var skip = false;
		if (options["header_removeReceived"] && line.match(/^Received:/i)) {
			skip = true;
		}
		else if (options["header_removeExtras"] && line.match(/^X-.+:/i)) {
			skip = true;
		}
		else if (options["header_removeSignatures"] && line.match(/^(DKIM|DomainKey)-Signature:/i)) {
			skip = true;
		}
		else {
			var contentTypeMatch = line.replace("[\n\r]","").match(/^Content-Type:[\s\r\n]*(.*)\/([^;\r\n\s]*)([^]*)/i);
			if (contentTypeMatch) {
				block["type"] = contentTypeMatch[1].toLowerCase();
				block["subtype"] = contentTypeMatch[2].toLowerCase();
				block["contentTypeLine"] = block["headerContent"].length;
				if (options["alternativeTextType"] != "all" && block["type"] == "multipart" && block["subtype"] == "alternative") {
					// need to keep content until we know if we have to change header
					block["storeContent"] = true;
				}
				// track boundary id
				var rest = contentTypeMatch[3];
				var boundaryMatch =  rest.match(/.*boundary=['"]?([^'"]*)['"]?/i);
				if (boundaryMatch && boundaryMatch[1]) {
					block["boundaryId"] = boundaryMatch[1];
				}
				var charsetMatch =  rest.match(/.*charset=['"]?([^'";\r\n]*)['"]?/i);
				if (charsetMatch && charsetMatch[1]) {
					block["charset"] = charsetMatch[1].toLowerCase();
				}
				if (block["filename"].length == 0) {
					// check possible file name
					var filenameMatch =  rest.match(/.*name=['"]?([^'";\r\n]*)['"]?/i);
					if (filenameMatch && filenameMatch[1]) {
						block["filename"] = filenameMatch[1];
					}
				}
			}
			else {
				// content disposition
				var contentDispositionMatch = line.match(/^Content-Disposition:[\s\r\n]*([^;\r\n\s]*)([^]*)/i);
				if (contentDispositionMatch) {
					block["isAttachment"] = (contentDispositionMatch[1] == "attachment");
					var rest = contentDispositionMatch[2];
					var filenameMatch = rest.match(/.*filename=['"]?([^'"]*)['"]?/i);
					if (filenameMatch && filenameMatch[1]) {
						block["filename"] = filenameMatch[1];
					}
				}
				else {
					// content encoding
					var contentEncodingMatch=line.match(/^Content-Transfer-Encoding:[\s\r\n]*([^;\r\n\s]*)/i);
					if (contentEncodingMatch) {
						block["encoding"] = contentEncodingMatch[1];
					}
					if (!block["encoding"]) {
						block["encoding"] = "none";
					}
				}
			}
		}
		return skip;
	},
	processCompleteHeader: function(block,options,streamWriter) {
		if (!block["charset"] && block["parentBlock"] && block["parentBlock"]["charset"]) {
			block["charset"] = block["parentBlock"]["charset"]; // inherit charset from parents
		}
		// writing header
		if (!block["storeContent"]) {
		// Check if attachment header needs to be replaced and content dismissed
			if (options["removeAttachments"] && block["isAttachment"]
				// do not remove certficates for signature and encryption
				&& !(block["type"] == "application" && (block["subtype"] == "pkcs7-mime" || block["subtype"] == "pkcs7-signature"))) {
				block["skipAll"] = true;
				streamWriter.writeLine("--"+block["id"]);
				streamWriter.writeLine(ShrinkContent.removedAttachmentSubstitutionText(block["filename"]));
			}
			else if (options["removeEmbeddedContent"] && !block["isAttachment"] && (block["type"] == "image" || block["type"] == "audio" || block["type"] == "video")) {
				block["skipAll"] = true;
				streamWriter.writeLine("--"+block["id"]);
				streamWriter.writeLine(ShrinkContent.removedEmbeddedSubstitutionText(block["filename"],block["type"],block["charset"]));
			}
			else {
				streamWriter.writeLines(block["headerContent"]);
				block["headerContent"]=[];
			}
		}
	},
	processBlockBeginning: function(id,parentBlock,line,block,blocks,newBlock) {
		if (blocks[blocks.length-1]["id"] == id && !block["parentBlock"]["storeContent"]) {
			blocks.pop(); // remove sibling from pile
		}
		block = newBlock();
		block["id"] = id;
		block["parentBlock"] = parentBlock;
		block["inHeader"] = true;
		if (parentBlock["storeContent"]) {
			block["storeContent"] = true;
		}
		block["headerContent"].push(line);
		blocks.push(block);
		var skip = true; // line already in header
		return [ block, skip ];
	},
	processBlockEnd: function(id,block,blocks,options,streamWriter) {
		var skip = false;
		if (!block["storeContent"]) { // normal block, to be removed from list
			if (blocks.length>1) {
				blocks.pop();
			}
		}
		else { // temporarily stored, might be closing an alternative
			var alternativeIndex = blocks.length-1;
			while (alternativeIndex>=0 && blocks[alternativeIndex]["storeContent"]) {
				alternativeIndex--;
			}
			alternativeIndex++;
			if (id == blocks[alternativeIndex]["boundaryId"]) {
				var writeAll = true;
				var rightTypeIndex = -1;
				for (var i=alternativeIndex+1;i<blocks.length;i++) {
					if (blocks[i]["type"] == "text" && blocks[i]["subtype"] == options["alternativeTextType"]) {
						rightTypeIndex = i;
						break;
					}
				}
				if (rightTypeIndex!=-1) {
					var alternativeBlock = blocks[alternativeIndex];
					var currentBlock = blocks[rightTypeIndex];
					var isKeep = false;
					var idsToKeep = {};
					while (currentBlock["parentBlock"]["id"] != alternativeBlock["id"]) {
						idsToKeep[currentBlock["id"]] = true;
						isKeep = true;
						currentBlock = currentBlock["parentBlock"];
					}
					var directChild = currentBlock;
					// keep only specified text type, and merge multipart header with its direct child
					alternativeBlock["headerContent"].splice(alternativeBlock["contentTypeLine"],1);
					streamWriter.writeLines(alternativeBlock["headerContent"]);
					directChild["headerContent"].shift(); // remove first line with block Id
					streamWriter.writeLines(directChild["headerContent"]);
					streamWriter.writeLines(directChild["content"]);
					// write all sub elements when there are any nested multiparts
					if (isKeep) {
						for (var i=alternativeIndex+1;i<blocks.length;i++) {
							if (idsToKeep[blocks[i]["id"]]) {
								var block = blocks[i];
								block["storeContent"] = false;
								ShrinkContent.processCompleteHeader(block,options,streamWriter);
								if (!(block["isAttachment"] && options["removeAttachments"])) {
									streamWriter.writeLines(block["content"]);
								}
							}
						}
					}
					writeAll = false;
					skip = true;
				}
				if (writeAll) { // no relevant part found, write all parts
					for (var i=alternativeIndex;i<blocks.length;i++) {
						streamWriter.writeLines(blocks[i]["headerContent"]);
						streamWriter.writeLines(blocks[i]["content"]);
					}
				}
				var i = blocks.length-1;
				for (var i=alternativeIndex+1;i<blocks.length;i++) {
					blocks[i]["storeContent"] = false;
					blocks.pop(); // remove alternative blocks
				}
				if (alternativeIndex>1) {
					blocks.pop();
				}
				else {
					blocks[alternativeIndex]["storeContent"] = false; // keep at least one block
				}
			}
		}
		block = blocks[blocks.length-1];
		return [ block, skip ];
	},
	processTextBody: function(line,block,options) {
		var skip = false;
		// test for quotes
		if (options["removeQuotedMessages"] &&  block["type"] == "text" && block["subtype"] == "plain" && block["encoding"] == "quoted-printable") {
			if (line.startsWith(">")) {
				block["quoteNumber"]++;
				var limit = options["maxQuoteLines"] + 1 ;
				if (block["quoteNumber"] == limit) {
					line = ">(...)";
				}
				else if (block["quoteNumber"] > limit) {
					skip = true;
				}
			}
			else {
				block["quoteNumber"] = 0;
			}
		}
		// test for signature
		else if (options["removeSignature"] &&  block["type"] == "text" && block["subtype"] == "plain") {
			if (block["encoding"] == "quoted-printable") {
				if (line == "--=20") {
					block["skipAll"] = true;
					skip = true;
				}
			}
			else if (line == "-- ") {
				block["skipAll"] = true;
				skip = true;
			}
		}
		return [ skip, line ];
	},
	messageDone: function(tempFile,msgHdr,result,initialSize,finalSize,status) {
		tempFile.remove(false);
		if (status == 0) {
			result["succeed"]++;
			result["initialSize"] += initialSize;
			result["finalSize"] += finalSize;
			ShrinkContent.processDeletion(msgHdr,false);
		}
		ShrinkContent.shrinkNextMessage(result);
	},
	processDeletion: function(msgHdr, forcePurge) { // delete only when a certain number of messages is present
		var messageList = ShrinkContent.pendingDeletions["messages"];
		var folder = ShrinkContent.pendingDeletions["folder"];
		// purge pending deletions if limit is reached or other folder traversed
		var purge = forcePurge || (messageList.length == 100) || (folder && msgHdr.folder != folder);
		if (purge) {
			folder.deleteMessages(messageList,null,!ShrinkContent.options["moveToTrash"],true,null,false);
			ShrinkContent.pendingDeletions["messages"] = Components.classes["@mozilla.org/array;1"].createInstance(Components.interfaces.nsIMutableArray);
			ShrinkContent.pendingDeletions["folder"] = null;
			}
		if (msgHdr) {
			messageList.appendElement(msgHdr, false);
			ShrinkContent.pendingDeletions["folder"] = msgHdr.folder;
		}
	},
	removedAttachmentSubstitutionText: function(filename) {
		var text = "Content-Type: text/x-moz-deleted; name=\"Deleted: "+ filename + "\"\r\n";
		text += "Content-Transfer-Encoding: 8bit\r\n";
		text += "Content-Disposition: inline; filename=\"Deleted: "+ filename + "\"\r\n";
		return text;
	},
	removedEmbeddedSubstitutionText: function(filename,fileType,charset) {
		if (!charset) {
			charset = "utf-8";
		}
		var text = "Content-Type: text/plain; charset="+charset+"\r\n";
		text += "Content-Transfer-Encoding: 8bit\r\n";
		text += "\r\n";
		text += "[ "+fileType+ " deleted "+(filename ? ": "+filename : "<no name>") +" ]\r\n\r\n";
		return text;
	},
	createAttachmentFileStream: function(folder,block) {
		// encoding
		var encoding = block["encoding"].toLowerCase();
		if (encoding != "base64" && encoding != "quoted-printable" && encoding != "7bit" && encoding != "8bit" && encoding != "binary" && encoding != "none") {
			throw (block["encoding"] + " encoding not supported when saving attachment");
		}
		// creating file
		var file = folder.clone();
		var filename = decodeMimeWord(block["filename"]);
		if (!filename) {
			if (block["type"] == "message") {
				filename="message.eml";
			}
			else {
				filename="noname";
			}
		}
		file.append(filename);
		file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE,parseInt("0600", 8));
		var outStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
		outStream.init(file, 2, 0x02 | 0x20, false); // write and truncate flags
		// stream separator
		var separator = "\n";
		if (encoding == "base64") {
			separator = "";
		}
		else if (block["type"] == "message") {
			separator = "\r\n";
		}
		return new OutputStreamWriter(outStream,1024,separator);
	},
	errorMessage: function(msgHdr,ex) {
		return "From: " + msgHdr.mime2DecodedAuthor + "\nSubject: "+ msgHdr.mime2DecodedSubject + "\n"+ex;
	},
	shutdown: function() {
 		ShrinkContent.status = ShrinkContent.CANCEL_STATUS; // stop current processing
 		ShrinkContent.prefs.removeObserver("", this);
 		if (ShrinkContent.tempDir.exists()) {
			ShrinkContent.tempDir.remove(true);
		}
 	}
};

window.addEventListener("load", function(e) { ShrinkContent.startup(); }, false);
window.addEventListener("unload", function(e) { ShrinkContent.shutdown(); }, false);