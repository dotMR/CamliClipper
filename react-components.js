var Hello = React.createClass({displayName: 'Hello',
    render: function() {
        return React.createElement("div", null, "Hello ", this.props.name);
    }
});

// TODO: require only 'options' for popup with needed properties as additional reqs
var Popup = React.createClass({
    displayName: 'Popup',

    propTypes: {
        imgSrc: React.PropTypes.string.isRequired,
        pageSrc: React.PropTypes.string.isRequired,
        serverConnection: React.PropTypes.object.isRequired,
        statusMessage: React.PropTypes.string,
        tags: React.PropTypes.string,
    },

    getInitialState: function() {
        return {
            statusMessage: this.props.statusMessage,
        };
    },

    handleError_: function(message) {
        this.setStatus(message);
    },

    setStatus: function(message) {
        this.setState({
            statusMessage: message}
        );
    },

    render: function() {
        return React.createElement("div", null,
            React.createElement(ImagePreview,
            {
                imgSrc: this.props.imgSrc,
                href: this.props.imgSrc,
                linkTitle: this.props.pageSrc
            }),
            React.createElement(ImageSubmitForm,
            {
                onError: this.handleError_,
                onProgress: this.handleError_,
                imgSrc: this.props.imgSrc,
                pageSrc: this.props.pageSrc,
                serverConnection: this.props.serverConnection,
                tags: this.props.tags,
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
        href: React.PropTypes.string.isRequired,
        linkTitle: React.PropTypes.string.isRequired,
    },

    render: function() {
        return React.createElement("div",
            {
                id: 'figure-target'
            },
            React.createElement("figure", {},
                React.createElement("image", {src: this.props.imgSrc}),
                React.createElement("figcaption", null,
                    React.createElement("a", {href: this.props.href}, this.props.linkTitle)
                )
            )
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
        };
    },

    handleImgSrcChange_: function(event) {
        this.setState({
            imgSrcInput: event.target.value}
        );
    },

    handlePageSrcChange_: function(event) {
        this.setState({
            pageSrcInput: event.target.value}
        );
    },

    handleTagsChange_: function(event) {
        this.setState({
            tagsInput: event.target.value}
        );
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
        if (this.state.imgSrcInput.startsWith('data:')) {
            return 'Sorry, encoded images are not yet supported';
        }

        if (this.state.tagsInput) {
            var tags = this.state.tagsInput.split(',').map(function(s) { return s.trim(); });
            var invalid = tags.some(function(t) { return !t });

            if (invalid) {
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
                    value: this.state.tagsInput
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

    initiateUpload_: function() {
        this.uploadImage_(this.fetchImage_(this.state.imgSrcInput))
          .then(this.createPermanode_)
          .then(this.addCamliContentRef_)
          .then(this.addImageSrcAttribute_)
          .then(this.addPageSrcAttribute_)
          .then(this.addTags_)
          .then(this.onFinish_)
          .catch(function(error) {
            console.log("Found error: ", error.message);
            this.props.onError(error.message);
          }.bind(this));
    },

	uploadImage_: function(fetchDataPromise) {
		return fetchDataPromise
			.then(this.checkForDuplicate_)
			.then(this.doUpload_);
	},

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
			  return results;
			});
	},

	doUpload_: function(results) {
		var sc = this.props.serverConnection;
		return sc.uploadBlob(results.blob).then(
		function(ref) {
			// capture fileRef returned from upload
			console.log('blob uploaded: ' + ref);
			results.fileref = ref;
			return results;
		});
	},

	createPermanode_: function(results) {
		var permanode = {
			"camliVersion": 1,
			"camliType": "permanode",
			"random": "" + Math.random()
		};

		var sc = this.props.serverConnection;

		return sc.signObject(permanode)
			.then(sc.uploadString.bind(sc))
			.then(
				function(data) {
					console.log('permanode created: ' + data);
					results.permanoderef = data
					return results;
				});
	},

	addCamliContentRef_: function(results) {
		var sc = this.props.serverConnection;
		return sc.updatePermanodeAttr(results.permanoderef, "set-attribute", "camliContent", results.fileref).then(
		function(data) {
			console.log('camliContent attribute added: ' + data);
			return results;
		});
	},

	addImageSrcAttribute_: function(results) {
		var sc = this.props.serverConnection;
		return sc.updatePermanodeAttr(results.permanoderef, "set-attribute", "imgSrc", this.state.imgSrcInput).then(
		function(data) {
			console.log('imgSrc attribute added: ' + data);
			return results;
		});
	},

	addPageSrcAttribute_: function(results) {
		var sc = this.props.serverConnection;
		return sc.updatePermanodeAttr(results.permanoderef, "set-attribute", "foundAt", this.state.pageSrcInput).then(
		function(data) {
			console.log('foundAt attribute added: ' + data);
			return results;
		});
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
				console.log('tag attributed added: ' + ref);
			});
			return results;
		});
	},

	onFinish_: function() {
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