"use strict";

/*
	interactions with UI components for options panel
*/

function initOptions() {
    setDisabled("maxQuoteLines","pref_removeQuotedMessages");
    setDisabled("attachmentFolder","pref_saveAttachment");
    setDisabled("attachmentFolderSelect","pref_saveAttachment");
    var saveAttachmentPref = document.getElementById("pref_attachmentFolder").value;
    if (saveAttachmentPref) {
    	document.getElementById("attachmentFolder").value = saveAttachmentPref.path;
	}
};

function setDisabled(elementId,refId) {
    document.getElementById(elementId).disabled = !document.getElementById(refId).value;
};

function toggleDisabled(elementId) {
    document.getElementById(elementId).disabled = !document.getElementById(elementId).disabled;
};

function selectAttachmentFolder() {
	var folderPref = document.getElementById("pref_attachmentFolder");
	var filePicker = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	var strbundle = document.getElementById("shrinkcontent-properties");
	var windowTitle = strbundle.getString("selectAttachmentFolder");
	filePicker.init(window, windowTitle, Components.interfaces.nsIFilePicker.modeGetFolder);
	try {
		if (folderPref.value) {
			filePicker.displayDirectory = folderPref.value;
		}
	}
	catch (e) {
		// ignore
	}
	if (filePicker.show() == Components.interfaces.nsIFilePicker.returnCancel) {
		return;
	}
	var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch('extensions.shrinkcontent.');
	prefs.setComplexValue("attachmentFolder",Components.interfaces.nsIFile,filePicker.file);
	document.getElementById("attachmentFolder").value = filePicker.file ?filePicker.file.path : "";
};
