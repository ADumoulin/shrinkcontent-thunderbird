Shrink Message Content (Thunderbird extension)
==============================================

This is an extension for Mozilla Thunderbird email client that allow to shrink message size by discarding unwanted content. It helps

It features :

* downsizing message header
* keeping only one text version between HTML and Plain Text
* removing and/or saving attachments
* removing embedded multimedia content
* removing Plain Text content like quoted messages or signatures
* processing large number of messages on IMAP and local folders both

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

on folders and subfolders

TODO: Write usage instructions

Contributing
------------
All contributions are welcome.

If you want to set up an installation that allows you to easily tinker with the extension source code, I'd recommend reading [this guide](https://developer.mozilla.org/en-US/Add-ons/Thunderbird/Building_a_Thunderbird_extension_7:_Installation) on how to locally install an extension.

I've found personnally that writing Thundebird extensions can be a real pain in the neck due to obscure, incomplete or downright nonexisting documentation. If you're not familiar with Mozilla extensions, you can check out the following links :

* a [XUL Reference](https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/XUL_Reference) for a reference on all XUL graphical widgets
* a (very narrow) [overview of Thunderbird components](https://developer.mozilla.org/en-US/Add-ons/Thunderbird/An_overview_of_the_Thunderbird_interface)
* an explanation on how to [provide localization to your extension](https://developer.mozilla.org/en-US/docs/Mozilla/Localization/Localizing_an_extension)
* helpful tips about [setting up an extension development environment](https://developer.mozilla.org/en-US/Add-ons/Setting_up_extension_development_environment)

License
-------
This code is under GPLv3 license (see LICENSE.txt file).