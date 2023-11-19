Scrum for Trello
===========

Scrum for Trello adds functionality to the awesome trello.com for use in Scrum projects.

Trello is the perfect online equivalent of the whiteboard with sticky notes aka the Scrum
board. One element we use are the storypoints. TrelloScrum gives you the ability to
make use of story points in Trello.

Setup
-----

Scrum for Trello is a Chrome extension. There is a version of it on the webstore, but it is currently broken due to changes Trello has made to their website. This repository is a fork of the original repository, with a (hopefully) fixed version.

Because of that, you can not install it via the webstore. You can only install it as an unpacked extension by cloning this repository and installing it from the Chrome "Extensions" page.

How does it work?
-----------------
In the card titles you can add the storypoints between parentheses. The assigned points
will be picked up by TrelloScrum and displayed in the upper right corner of the card.

For each list the total amount of story points will be calculated and shown in the title
of the list.

Every second the story points will be detected and calculated. So changing a number or moving
a card will be reflected almost immediately.


Credits
-------
TrelloScrum was developed by [Marcel Duin](http://webglmarcel.q42.net/) and [Jasper Kaizer](https://twitter.com/jkaizer)
during our pet projects time at [Q42](http://q42.com).

Great improvements made by @nicpottier and @paullofte:

* The point value is moved to be a badge on the card.
* Added support for Zero Point Cards (0), Unknown Point Cards (?), Decimal Value Cards (.5)
* In addition I added the functionality to have the list total reflect the current filtered set of cards.


