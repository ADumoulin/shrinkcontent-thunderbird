ARCHIVENAME=shrinkcontent
INCLUDED=chrome defaults chrome.manifest install.rdf LICENSE.txt

all:
	/usr/bin/zip -r $(ARCHIVENAME).xpi $(INCLUDED)

clean:
	rm $(ARCHIVENAME).xpi