# CamliClipper
Chrome extension for clipping web images and sending to [Camlistore](www.camlistore.org).

In addition to image upload, you can provide additional metadata for the image's permanode such as:
- source URL of the image
- URL of the page where you found the image (article, gallery, etc)
- tags to apply to the image

##Notes
- WIP: This is a work-in-progress. See popup.js for current TODO list.
- I've tried to conform to the full camlistore sign/upload process. But if I missed something, let me know.
- Currently almost everything is hard-coded, so if you're not using against localhost:3179 you're going to have to modify all the functions. Working on that...
- For installation, follow the directions [here](https://developer.chrome.com/extensions/getstarted#unpacked)



