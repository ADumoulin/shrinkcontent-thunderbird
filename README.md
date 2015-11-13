Shrink Message Content (Thunderbird extension)
==============================================

This code provides an extension for Mozilla Thunderbird email client that allows to shrink message size by discarding unwanted content. The problem with email is that there is no way of keeping only the relevant information it contains, so you are faced with the choice of either deleting it or having to store it with all its fancy content (a billion lines of quotes for messages that you already have, embedded images, a html version even when you only display plain text,...).

This extension allows you to get rid of all the bloated information that you don't need, easily remove embedded content and attachments, and thus provides you with the means to keep all your emails on a server without requiring an extravagant quota amount.

It features :

* downsizing message header with a few sensible options
* keeping only one text version between HTML and Plain Text
* removing and/or saving attachments
* removing embedded multimedia content
* removing content like quoted messages or signatures (for plain text only)
* processing large number of messages on IMAP and local folders both

WARNING :
This add-on permanently removes content from your messages, unless they've been moved to trash with the proper option activated and you restore them manually. Is it strongly recommended to back up your messages in a local folder before attempting to shrink them.

Known limitations
-----------------
The extension does not work with IMAP accounts that are not stored locally.

Installation
------------
The simplest way to install this plugin is to get it directly through the Thundebird add-on manager.

Alternatively, you can create the extension .xpi archive by using the provided makefile with
```
make
```
then select it through the "Install add-on from file" options in the add-on manager tools.

Usage
-----
The plugin is easy enough to use : adjust the preferences to activate the options you need, select a bunch of folder or messages and choose "Shrink" from the right-click context menu.

To speed up processing of IMAP accounts, it is strongly recommended to switch the messages details to an unrelated folder or view once the shrinking has been started, otherwise the automatic synching of the interface will have a heavy impact on overall speed.

Here is a detail of the options you can choose from.

Header options :

You might want to turn all header options, as they will not make you loose any important information and they are not visible in the Thunderbird interface anyway. You might be surprised how much junk can be stored in header nowadays, they are sometimes bigger than the body of the message.

* remove 'Received' fields : these fields indicate the network route the message has come through and they can be VERY long. The mail server probably parses this in real-time to detect incoming spam, but they are of very little use to you.
* remove DKIM signatures : these help authentify trusted domains through which the message has transited. All well and good, but once again if you're not the mail server administrator you probably won't bother keeping those in your messages once they have been safely delivered to your inbox.
* remove Extra fields : those fields beginning with an X can store pretty much any information, from antivirus ratings to user agent signatures, weather forecast and useful stamp collecting tips. Honestly, just do yourself a favor and dump it all.

Body content options :

HTML messages will always include a plain text version as well for clients that do not support HTML display. This means that the message content is indeed almost always duplicated, unless the sender has specifically sent it in plain text only. You can choose to keep the plain text or the HTML version only, and thus reclaim a lot of useless bytes.

Furthermore, for plain text body, you can choose to limit the number of quotes of other messages to a given number of lines (0 to remove them altogether). Note that this will only work if the quotes are properly encoded by beginning with a '>', there is no magical parsing for the clients that do not follow this standard.

You can also remove lengthy signatures that are appended at the end of a message. Once again, this will only work if they follow the signature standard, which sadly is rarely the case for applications that append content like antiviruses or cellphones email applications.

Attachments options :

You can choose to remove attachments from the selected messages. They will still be visible with a size of 0 bytes, like when you delete attachments manually from the message context menu.

You can have the attachments saved to a local folder, even if you don't choose to remove them. There is no overwriting in case of multiple attachments sharing the same name.

The embedded multimedia content, usually images or logos placed inside the HTML, can be removed as well. There is no currently option to save that data, as I see no use for it, but if requested I will add it later on.

Finally, you can choose to put the original message in the trash (the default option), otherwise it will just be plainly deleted.

Contributing
------------
All contributions are welcome.

If you want to set up an installation that allows you to easily tinker with the extension source code, I'd recommend reading [this guide](https://developer.mozilla.org/en-US/Add-ons/Thunderbird/Building_a_Thunderbird_extension_7:_Installation) on how to locally install an extension.

Personnally, I've found that writing Thundebird extensions can be a real pain in the neck due to obscure, incomplete or downright nonexisting documentation. If you're not familiar with Mozilla extensions, you can check out the following links :

* a [XUL Reference](https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/XUL_Reference) for a reference on all XUL graphical widgets
* a (very narrow) [overview of Thunderbird components](https://developer.mozilla.org/en-US/Add-ons/Thunderbird/An_overview_of_the_Thunderbird_interface)
* an explanation on how to [provide localization to your extension](https://developer.mozilla.org/en-US/docs/Mozilla/Localization/Localizing_an_extension)
* helpful tips about [setting up an extension development environment](https://developer.mozilla.org/en-US/Add-ons/Setting_up_extension_development_environment)

License
-------
This code is under GPLv3 license (see LICENSE file).