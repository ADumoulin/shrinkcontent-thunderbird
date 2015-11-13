"use strict";

/*
	all interactions with UI components
*/

var ShrinkContentUI = {
	startup : function() {
		if (document.getElementById("shrinkcontent-statusbarsection")) { // install callbacks for main process, in overlay window only
			ShrinkContent.notifyUpdate = function(result) {
				if (ShrinkContent.status == ShrinkContent.RUNNING_STATUS) {
					var processed = result["processed"];
					var numberSelected = result["numberSelected"];
					var strbundle = document.getElementById("shrinkcontent-properties");
					var statusbar = document.getElementById('shrinkcontent-statusbar');
					var newLabel = strbundle.getFormattedString("progressMessage", [ processed, numberSelected ]);
					statusbar.label = newLabel;
				}
 			};
			ShrinkContent.notifyFinish = function(result) {
 				var autoSyncManager = Components.classes["@mozilla.org/imap/autosyncmgr;1"].getService(Components.interfaces.nsIAutoSyncManager);
				autoSyncManager.resume(); // resume autosync manager
				document.getElementById('shrinkcontent-statusbarsection').hidden = true;
				var dialogResult = { "result": result };
				window.openDialog('chrome://shrinkcontent/content/shrinkcontent-resultdialog.xul',"","chrome,modal,centerscreen,resizable",dialogResult);
				statusbar.src = "chrome://shrinkcontent/skin/cancel_icon.png";
			};
		}
	},
	startProcess: function(isMessageSelection) {
		var numberSelected = 0;
		var selection;
		var folderSelection = [];
		if (isMessageSelection) {
			selection = gFolderDisplay.selectedMessages;
			numberSelected = selection.length;
			if (numberSelected > 0) {
				folderSelection.push(selection[0].folder);
			}
		}
		else {
			selection = gFolderTreeView.getSelectedFolders();
			if (selection) {
				for (var i=0;i<selection.length;i++) {
					numberSelected += selection[i].getTotalMessages(true);
					folderSelection.push(selection[i]);
				}
			}
		}
		// download messages to offline store to prevent stream blocking
		var forceDownload = function(folderList,withSubFolders) {
			if (folderList.length == 0 || folderList[0].server.type != "imap") { // fire up dialog
				var dialogResult = { "numberSelected": numberSelected, "ready": ShrinkContent.status == ShrinkContent.READY_STATUS };
				window.openDialog('chrome://shrinkcontent/content/shrinkcontent-confirmdialog.xul',"","chrome,modal,centerscreen,resizable",dialogResult);
				if (!dialogResult.cancel) {
		 			var strbundle = document.getElementById("shrinkcontent-properties");
					var message = strbundle.getFormattedString("progressMessage", [ 0, numberSelected ]);
					document.getElementById('shrinkcontent-statusbar').label = message;
					document.getElementById('shrinkcontent-statusbarsection').hidden = false;
					ShrinkContent.shrinkMessages(selection,numberSelected,!isMessageSelection);
				}
			}
			else {
				var folder = folderList.pop();
				if (withSubFolders && folder.hasSubFolders) {
					var folderEnumerator = folder.subFolders;
					while (folderEnumerator.hasMoreElements()) {
				  		var subfolder = folderEnumerator.getNext().QueryInterface(Components.interfaces.nsIMsgFolder);
				  		folderList.push(subfolder);
					}
				}
				try {
					folder.downloadAllForOffline({ 
						OnStopRunningUrl : function(url,status) {
							forceDownload(folderList,withSubFolders);
						}
					},msgWindow);
				}
				catch (ex) {
					forceDownload(folderList,withSubFolders); // continue if sync doesn't work
				}
			}
		}
		forceDownload(folderSelection,!isMessageSelection);
		var autoSyncManager = Components.classes["@mozilla.org/imap/autosyncmgr;1"].getService(Components.interfaces.nsIAutoSyncManager);
		autoSyncManager.pause(); // stop autosync manager as it tends to block streams

	},
	cancelProcessing: function() {
		var dialogResult = { "cancel": true };
		window.openDialog('chrome://shrinkcontent/content/shrinkcontent-confirmdialog.xul',"","chrome,modal,centerscreen,resizable",dialogResult);
		if (!dialogResult.cancel) {
	 		ShrinkContent.status = ShrinkContent.CANCEL_STATUS;
			document.getElementById('shrinkcontent-statusbarsection').hidden = true;
		}
	},
	showMenu: function() {
		var show = true;
		var selectedFolders = gFolderTreeView.getSelectedFolders();
		if (selectedFolders && selectedFolders.length > 0) {
			var cannotProcess = false;
			for (var i=0;i<selectedFolders.length;i++) {
				var folder = selectedFolders[i];
				try {
					var server = folder.server.QueryInterface(Components.interfaces.nsIImapIncomingServer);
					if (!(folder.canFileMessages && server.offlineDownload)) { // doesn't work if messages are not offline
						cannotProcess = true;
						break;
					}
				}
				catch (ex) {
					// ignore, might not be IMAP server
				}
			}
			show = !cannotProcess;
		}
		document.getElementById("shrinkcontent-shrinkfoldersaction").hidden = !show;
	},
	initConfirmDialog: function() {
 		var numberSelected = window.arguments[0].numberSelected;
 		var ready = window.arguments[0].ready;
 		var cancel = window.arguments[0].cancel;
 		var strbundle = document.getElementById("shrinkcontent-properties");
		var message;
 		if (cancel) {
			message = strbundle.getString("confirmCancelMessage");
 		}
 		else if (!ready) {
			message = strbundle.getString("confirmInProgressMessage");
			document.getElementById("shrinkcontent-confirmdialog").buttons = "accept";
	 		window.arguments[0].overridecancel = true;
 		}
		else if (numberSelected == 0) {
			message = strbundle.getString("confirmNoMessage");
			document.getElementById("shrinkcontent-confirmdialog").buttons = "accept";
	 		window.arguments[0].overridecancel = true;
		}
		else if (numberSelected == 1) {
			message = strbundle.getString("confirmSingleMessage");
		}
		else {
			message = strbundle.getFormattedString("confirmMessage", [ numberSelected ]);
 		}
 		document.getElementById("shrinkcontent-confirmdialogmessage").textContent = message;
 	},
	exitConfirmDialog: function(cancel)	{
 		window.arguments[0].cancel = window.arguments[0].overridecancel ? true : cancel;
 	},
 	initResultDialog: function() {
 		// summary message
 		var result = window.arguments[0].result;
 		var strbundle = document.getElementById("shrinkcontent-properties");
		var message;
		if (result["succeed"] == 1) {
			message = strbundle.getFormattedString("resultSingleMessage", [ result["succeed"], result["numberSelected"] ]);
		}
		else {
			message = strbundle.getFormattedString("resultMessage", [ result["succeed"], result["numberSelected"] ]);
		}
		if (result["succeed"]>0) {
			var diff = result["initialSize"] - result["finalSize"];
			if (diff <0) {
				diff = 0;
			}
			var diffSize = humanReadableSize(diff);
			var compressRate = (100 * (result["initialSize"] - result["finalSize"]) / result["initialSize"]).toFixed(0);
			message += " : " + strbundle.getFormattedString("resultMessageStats", [ diffSize, compressRate ]);
	 	}
 		document.getElementById("shrinkcontent-resultdialogmessage").textContent = message;
		// errors
		var nbErrors = result["errors"].length;
		document.getElementById("shrinkcontent-resultdialogerrorsection").hidden = (nbErrors == 0);
		if (nbErrors>0) {
			var errorMessageLabel;
			if (nbErrors == 1) {
				errorMessageLabel = strbundle.getString("errorSingleMessage");
			}
			else {
				errorMessageLabel = strbundle.getFormattedString("errorMessage", [ nbErrors ]);
			}
			document.getElementById("shrinkcontent-resultdialogerrorlabel").value = errorMessageLabel;
			var errorMessage ="";
 			for (var i=0;i<nbErrors;i++) {
 				errorMessage += result["errors"][i];
 				if (i<nbErrors-1) {
 					errorMessage += "\n\n";
 				}
			}
			document.getElementById("shrinkcontent-resultdialogerror").value = errorMessage;
 			document.getElementById('shrinkcontent-resultdialogerrordetails').value += ' \u25BC';
 	 	}
 	},
 	toggleErrorDetails: function() {
 		var hidden = document.getElementById('shrinkcontent-resultdialogerror').hidden;
 		var details = document.getElementById('shrinkcontent-resultdialogerrordetails');
 		details.value = details.value.substring(0,details.value.length-1);
 		details.value += (hidden ? '\u25B2' : '\u25BC');
 		document.getElementById('shrinkcontent-resultdialogerror').hidden = !hidden;
 		window.sizeToContent();
 	}
};


window.addEventListener("load", function(e) { ShrinkContentUI.startup(); }, false);