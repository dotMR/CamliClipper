var Popup = React.createClass({
    displayName: 'Popup',

    propTypes: {
        config: React.PropTypes.shape({
            url: React.PropTypes.string.isRequired,
            defaultTags: React.PropTypes.string
        }).isRequired,
        queryString: React.PropTypes.string.isRequired,
        serverConnection: React.PropTypes.object.isRequired
    },

    getInitialState: function() {
        return {
            statusMessage: '',
        };
    },

    // thanks: https://css-tricks.com/snippets/javascript/get-url-variables/
    getQueryParam_: function(param) {
        var vars = this.props.queryString.split("&");
        for (var i=0; i<vars.length; i++) {
            var pair = vars[i].split("=");
            if (pair[0] == param){ return pair[1]; }
        }
       return false;
    },

    setStatus: function(message) {
        this.setState({
            statusMessage: message}
        );
    },

    render: function() {
        return React.createElement("div", null,
            React.createElement("h3", null, "C3: Camli Clipper (Chrome)"),
            React.createElement(ImagePreview,
            {
                imgSrc: this.getQueryParam_('imgSrc'),
            }),
            React.createElement(ImageSubmitForm,
            {
                onError: this.setStatus,
                onProgress: this.setStatus,
                imgSrc: this.getQueryParam_('imgSrc'),
                pageSrc: this.getQueryParam_('pageSrc'),
                serverConnection: this.props.serverConnection,
                tags: this.props.config.defaultTags,
            }),
            React.createElement(Status,
            {
                message: this.state.statusMessage,
            })
        );
    }
});

var Status = React.createClass({
    displayName: 'Status',

    propTypes: {
        message: React.PropTypes.string.isRequired,
    },

    render: function() {
        return React.createElement("div",
            {
                id: 'status'
            },
            this.props.message
        );
    }
});

var ImagePreview = React.createClass({
    displayName: 'ImagePreview',

    propTypes: {
        imgSrc: React.PropTypes.string.isRequired,
    },

    render: function() {
        return React.createElement("figure", null,
            React.createElement("image", {src: this.props.imgSrc})
        );
    }
});

var ImageSubmitForm = React.createClass({
    displayName: 'ImageSubmitForm',

    propTypes: {
        imgSrc: React.PropTypes.string.isRequired,
        onError: React.PropTypes.func.isRequired,
        onProgress: React.PropTypes.func.isRequired,
        pageSrc: React.PropTypes.string,
        serverConnection: React.PropTypes.object.isRequired,
        tags: React.PropTypes.string,
    },

    componentWillMount: function() {
        var message = this.validateForm_();
        if (message) {
            this.props.onError(message)
        }
    },

    getInitialState: function() {
        return {
            imgSrcInput: this.props.imgSrc,
            pageSrcInput: this.props.pageSrc,
            tagsInput: this.props.tags,
            tagsInvalid: false
        };
    },

    handleImgSrcChange_: function(event) {
        this.setState({
            imgSrcInput: event.target.value
        });
    },

    handlePageSrcChange_: function(event) {
        this.setState({
            pageSrcInput: event.target.value
        });
    },

    handleTagsChange_: function(event) {
        this.setState({
            tagsInput: event.target.value,
            tagsInvalid: false
        });
    },

    handleOnSubmit_: function(event) {
        event.preventDefault();
        var error = this.validateForm_();
        if (error) {
             this.props.onError(error)
        } else {
            this.initiateUpload_();
        }
    },

    validateForm_: function() {
        // if (this.state.imgSrcInput.startsWith('data:')) {
        //     return 'Sorry, encoded images are not yet supported';
        // }

        if (this.state.tagsInput) {
            var tags = this.state.tagsInput.split(',').map(function(s) { return s.trim(); });
            var invalid = tags.some(function(t) { return !t });

            if (invalid) {
                this.setState({
                    tagsInvalid: true
                });
                return 'At least one invalid tag was supplied';
            }
        }

        return '';
    },

    render: function() {
        return React.createElement("form",
            {
                id: 'upload-form',
                method: 'POST',
                onSubmit: this.handleOnSubmit_,
            },
            React.createElement("label", {htmlFor: 'imageSrc'}, 'Image URL'),
            React.createElement("input",
                {
                    onChange: this.handleImgSrcChange_,
                    id: 'imageSrc',
                    type: 'text',
                    name: 'img',
                    value: this.state.imgSrcInput
                }
            ),
            React.createElement("label", {htmlFor: 'pageSrc'}, 'Found on Page'),
            React.createElement("input",
                {
                    onChange: this.handlePageSrcChange_,
                    id: 'pageSrc',
                    type: 'text',
                    name: 'img',
                    value: this.state.pageSrcInput
                }
            ),
            React.createElement("label", {htmlFor: 'tags'}, 'Additional Tags'),
            React.createElement("input",
                {
                    onChange: this.handleTagsChange_,
                    id: 'tags',
                    type: 'text',
                    name: 'img',
                    value: this.state.tagsInput,
                    className: this.state.tagsInvalid ? 'invalid' : '',
                }
            ),
            React.createElement("input",
                {
                    type: 'submit',
                    value: 'Send to Camlistore'
                }
            )
        );
    },

    // dataURItoBlob_: function(dataURI) {
    //     // convert base64 to raw binary data held in a string
    //     // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
    //     var byteString = atob(dataURI.split(',')[1]);
     
    //     // separate out the mime component
    //     var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
     
    //     // write the bytes of the string to an ArrayBuffer
    //     var ab = new ArrayBuffer(byteString.length);
    //     var ia = new Uint8Array(ab);
    //     for (var i = 0; i < byteString.length; i++) {
    //         ia[i] = byteString.charCodeAt(i);
    //     }
     
    //     // write the ArrayBuffer to a blob, and you're done
    //     var bb = new BlobBuilder();
    //     bb.append(ab);
    //     return bb.getBlob(mimeString);
    // },

    initiateUpload_: function() {
        // TODO: rework flow to allow for either dataURI or URL
        // see also: http://stackoverflow.com/questions/12168909/blob-from-dataurl
        //           https://github.com/ebidel/filer.js/blob/master/src/filer.js#L137

        // var dataURI = this.state.imgSrcInput;

        // if(dataURI.startsWith('data:')) {
        //     var byteString = atob(dataURI.split(',')[1]);
        //     var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
         
        //     // write the bytes of the string to an ArrayBuffer
        //     var ab = new ArrayBuffer(byteString.length);
        //     var ia = new Uint8Array(ab);
        //     for (var i = 0; i < byteString.length; i++) {
        //         ia[i] = byteString.charCodeAt(i);
        //     }

        //     var blobref = 'sha1-' + Crypto.SHA1(ia);
        //     console.log('hash computed: ' + blobref);

        //     var blob = new Blob([ia], {type: mimeString}); // this works!
        // }

        this.fetchImage_(this.state.imgSrcInput)
          .then(this.checkForDuplicate_)
          .then(this.doUpload_)
          .then(this.createPermanode_)
          .then(this.addPermanodeMetadata_)
          .then(this.onFinish_)
          .catch(function(error) {
            console.log("Error caught: ", error.message);
            this.props.onError(error.message);
          }.bind(this));
    },

    // TODO: make distinction here between dataURI and URL
    // two paths, both endwith assembleResults and then pass to checkForDuplicate
    fetchImage_: function(url) {
        console.log('fetching image from: ' + url);
        return this.getAsBlob_(url)
            .then(this.captureBlobAndComputeRef_)
            .then(this.assembleResults_);
    },

    captureBlobAndComputeRef_: function(blob) {
        var resolvedBlob = Promise.resolve(blob);
        var blobref = this.convertToTypedArray_(blob).then(this.generateHash_);

        return Promise.all([resolvedBlob, blobref]);
    },

    convertToTypedArray_: function(blob) {
        return new Promise(function(resolve, reject) {
            var reader  = new FileReader();

            reader.onload = function() {
                if (reader.readyState === 2) {
                    console.log('blob converted to typed array');
                    resolve(reader.result);
                }
            }.bind(this);

            reader.onerror = function() {
                reject(Error('There was an error converting the image blob to a typed array'));
            }

            reader.readAsArrayBuffer(blob);
        });
    },

    generateHash_: function(arrayBuffer) {
        var bytes = new Uint8Array(arrayBuffer);
        var blobref = 'sha1-' + Crypto.SHA1(bytes);
        console.log('hash computed: ' + blobref);
        return blobref;
    },

    // 'readable=ify' the results
    assembleResults_: function(results) {
        return {
            'blob': results[0],
            'blobref': results[1]
        };
    },

    checkForDuplicate_: function(results) {
        console.log('checking for duplicates');
        var sc = this.props.serverConnection;
        return sc.findExisting(results.blobref).then(
            function(json) {
                return results; // ignore empty json and keep passing results
            });
    },

    doUpload_: function(results) {
        var sc = this.props.serverConnection;
        return sc.uploadBlob(results.blob).then(
        function(ref) {
            console.log('blob uploaded: ' + ref);
            results.fileref = ref;
            return results;
        });
    },

    createPermanode_: function(results) {
        var sc = this.props.serverConnection;
        return sc.createPermanode().then(
            function(data) {
                console.log('permanode created: ' + data);
                results.permanoderef = data
                return results;
        });
    },

    addPermanodeMetadata_: function(results) {
        var camliContent = this.addCamliContentRef_(results.permanoderef, results.fileref);
        var imgSrc = this.addImageSrcAttribute_(results.permanoderef, this.state.imgSrcInput);
        var pageSrc = this.addPageSrcAttribute_(results.permanoderef, this.state.pageSrcInput);
        var tags = this.addTags_(results);

        return Promise.all([camliContent, imgSrc, pageSrc, tags]);
    },

    updatePermanodeAttr_: function(ref, operation, attribute, value) {
        var sc = this.props.serverConnection;
        return sc.updatePermanodeAttr(ref, operation, attribute, value).then(
        function(data) {
            console.log(attribute + ' attribute added: ' + data);
            return data;
        });
    },

    addCamliContentRef_: function(permanoderef, fileref) {
        return this.updatePermanodeAttr_(permanoderef, "set-attribute", "camliContent", fileref);
    },

    addImageSrcAttribute_: function(permanoderef, value) {
        return this.updatePermanodeAttr_(permanoderef, "set-attribute", "imgSrc", value);
    },

    addPageSrcAttribute_: function(permanoderef, value) {
        return this.updatePermanodeAttr_(permanoderef, "set-attribute", "foundAt", value);
    },

    addTags_: function(results) {
        var sc = this.props.serverConnection;
        var promises = [];
        var tags = this.state.tagsInput.split(',').map(function(s) { return s.trim(); });
        tags.forEach(function(tag) {
        if (tag) {
            promises.push(sc.updatePermanodeAttr(results.permanoderef, "add-attribute", "tag", tag));
        }
        });

        return Promise.all(promises).then(function(results) {
            results.forEach(function(ref) {
                console.log('tag attribute added: ' + ref);
            });
            return results;
        });
    },

    onFinish_: function(results) {
        this.props.onProgress('Success!');
    },

    /**
     * Request to load a url as a 'blob'
     *
     * @param {string} url of item to download as blob.
     * @return {Promise} Promise of blob data.
     */
    getAsBlob_:function (url) {
        return new Promise(function(resolve, reject) {
            var request = new XMLHttpRequest();
            request.open('GET', url);
            request.responseType = 'blob';

            request.onload = function() {
                if (request.status === 200) {
                resolve(request.response);
                } else {
                reject(Error('Blob didn\'t load successfully; error:' + request.statusText));
                }
            }.bind(this);

            request.onerror = function() {
                reject(Error('There was a network error loading the blob'));
            };

            request.send();
        });
    },
});

var OptionsPopup = React.createClass({
    displayName: 'OptionsPopup',

    getInitialState: function() {
        return {
            statusMessage: ''
        };
    },

    setStatus: function(message) {
        this.setState({
            statusMessage: message}
        );
    },

    render: function() {
        return React.createElement("div", null,
            React.createElement("h3", null, "Options"),
            React.createElement(OptionsForm,
            {
                onError: this.setStatus,
                onProgress: this.setStatus,
            }),
            React.createElement(Status,
            {
                message: this.state.statusMessage,
            })
        );
    }
});

var OptionsForm = React.createClass({
    displayName: 'OptionsForm',

    propTypes: {
        onError: React.PropTypes.func.isRequired,
        onProgress: React.PropTypes.func.isRequired
    },

    componentWillMount: function() {
        this.runFormValidation_();
    },

    runFormValidation_: function() {
        var message = this.validateForm_();
        if (message) {
            this.props.onError(message)
        }
    },

    getInitialState: function() {
        return {
            serverUrl: '',
            defaultTags: '',
            tagsInvalid: false
        };
    },

    componentDidMount: function() {
        this.fetchOptions_()
        .then(this.updateForm_)
        .catch(function(error) {
            this.props.onError(error.message);
        }.bind(this))
    },

    fetchOptions_: function() {
        return new Promise(function(resolve, reject) {
            chrome.storage.sync.get(['url', 'defaultTags'], function(items) {
                if (chrome.runtime.lastError) {
                    console.log('Error getting options');
                    reject(chrome.runtime.lastError) // TODO: how to forcibly test this error condition?
                }
                resolve(items);
            });
        });
    },

    saveOptions_: function() {
        this.props.onProgress('Saving...');
        return new Promise(function(resolve, reject) {
            chrome.storage.sync.set(
                {
                    serverUrl: this.state.serverUrl,
                    defaultTags: this.state.defaultTags
                },
                function() {
                    if (chrome.runtime.error) {
                        reject(Error('Error saving options'));
                    } else {
                        resolve();
                    }
                }
            );
        }.bind(this));
    },

    onFinish_: function() {
        this.props.onProgress('Options saved!');
        setTimeout(function() {
              this.props.onProgress('');
            }.bind(this), 1500);
    },

    updateForm_: function(options) {
        this.setState({
            serverUrl: options.url,
            defaultTags: options.defaultTags
        }, this.runFormValidation_);
    },

    handleUrlChange_: function(event) {
        this.setState({
            serverUrl: event.target.value
        });
    },

    handleTagsChange_: function(event) {
        this.setState({
            defaultTags: event.target.value,
            tagsInvalid: false
        });
    },

    handleOnSubmit_: function(event) {
        event.preventDefault();
        this.validateForm_()
        .then(this.saveOptions_)
        .then(this.onFinish_)
        .catch(function(error) {
            this.props.onError(error.message);
        }.bind(this));
    },

    validateForm_: function() {
        return new Promise(function(resolve, reject) {
            if (this.state.defaultTags) {
                var tags = this.state.defaultTags.split(',').map(function(s) { return s.trim(); });
                var invalid = tags.some(function(t) { return !t });

                if (invalid) {
                    this.setState({
                        tagsInvalid: true
                    });
                    reject(Error('At least one invalid tag was supplied'));
                }
            }

            resolve();
        }.bind(this));
    },

    render: function() {
        return React.createElement("form",
            {
                id: 'options-form',
                onSubmit: this.handleOnSubmit_,
            },
            React.createElement("label", {htmlFor: 'serverUrl'}, 'Server URL'),
            React.createElement("input",
                {
                    onChange: this.handleUrlChange_,
                    id: 'serverUrl',
                    type: 'text',
                    value: this.state.serverUrl
                }
            ),
            React.createElement("label", {htmlFor: 'defaultTags'}, 'Default Tag(s)'),
            React.createElement("input",
                {
                    onChange: this.handleTagsChange_,
                    id: 'defaultTags',
                    type: 'text',
                    value: this.state.defaultTags,
                    className: this.state.tagsInvalid ? 'invalid' : ''
                }
            ),
            React.createElement("input",
                {
                    type: 'submit',
                    value: 'Save'
                }
            )
        );
    }
});