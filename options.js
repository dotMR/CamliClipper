/** McFly */

var Flux = new McFly();

/** API */

var API = {
    fetchOptions: function() {
        return new Promise(function(resolve, reject) {
            chrome.storage.sync.get(['url', 'defaultTags'], function(items) {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError) // TODO: how to forcibly test this error condition?
                }
                resolve(items);
            });
        });
    },
    saveOptions: function(options) {
        return new Promise(function(resolve, reject) {
            chrome.storage.sync.set(
                {
                    serverUrl: options.serverUrl,
                    defaultTags: options.defaultTags
                },
                function() {
                    if (chrome.runtime.error) {
                        reject(Error(chrome.runtime.error)); // TODO: how to forcibly test this error condition?
                    } else {
                        resolve();
                    }
                }
            );
        }.bind(this));
    }
}

/** Actions */

var OptionsActions = Flux.createActions({
    fetchOptions: function(){
        console.log('fetching options');
        return API.fetchOptions()
            .then(function(options){
                return {
                    actionType: "OPTIONS_FETCHED",
                    options: options
                }
            });
    },
    saveOptions: function(options){
        console.log('saving options');
        return API.saveOptions(options)
            .then(API.fetchOptions)
            .then(function(options) {
                return {
                    actionType: "OPTIONS_SAVED",
                    options: options
                }
            });
    },
});

var StatusAction = Flux.createActions({
    updateStatus: function(status) {
        console.log('updating status');
        return {
            actionType: "STATUS_UPDATED",
            status: status
        };
    }
});

/** Store */

var _options = {};
var _status = '';

function setOptions_(options) {
    _options = options;
}

function setStatus_(status) {
    _status = status;
}

var OptionStore = Flux.createStore(
    {
        getOptions: function() {
           return _options;
        },
    },
    function(payload) {
        switch(payload.actionType) {
            case "OPTIONS_FETCHED":
            case "OPTIONS_SAVED":
                console.log('updating store');
                setOptions_(payload.options);
                OptionStore.emitChange();
                break;
        }
    }
);

var StatusStore = Flux.createStore(
    {
        getStatus: function() {
           return _status;
        },
    },
    function(payload) {
        switch(payload.actionType) {
            case "OPTIONS_SAVED":
                console.log('updating status');
                setStatus_('Saved');
                StatusStore.emitChange();
                break;
            case "STATUS_UPDATED":
                console.log('status updated');
                setStatus_(payload.status);
                StatusStore.emitChange();
                break;
        }
    }
)

/** Controller View */

// TODO: Field errors should be shown near the field
// TODO: Make 'Saved' message disappear after short time. Who is responsible for that?
// TODO: What component manages status? does form just communicate via property and you can choose to ignore if you like?

var OptionsController = React.createClass({

    mixins: [OptionStore.mixin, StatusStore.mixin],

    getInitialState: function() {
        return {
            options: OptionStore.getOptions(),
            status: StatusStore.getStatus()
        };
    },

    // TODO: can this respond to only one store changes?
    //       It would be nice to not have to update the options state when the only status message changes
    storeDidChange: function() {
        this.setState({
            options: OptionStore.getOptions(),
            status: StatusStore.getStatus()
        });
    },

    render: function() {
        return React.createElement(OptionsPopup, {
            config: this.state.options,
            status: this.state.status
        });
    }
});

var OptionsPopup = React.createClass({
    displayName: 'OptionsPopup',

    propTypes: {
        config: React.PropTypes.object.isRequired,
        status: React.PropTypes.string
    },

    componentDidMount: function() {
        OptionsActions.fetchOptions();
    },

    render: function() {
        return React.createElement("div", null,
            React.createElement("h3", null, "Options"),
            React.createElement(OptionsForm,
            {
                serverUrl: this.props.config.url,
                defaultTags: this.props.config.defaultTags
            }),
            React.createElement(Status,
            {
                message: this.props.status,
            })
        );
    }
});

var OptionsForm = React.createClass({
    displayName: 'OptionsForm',

    propTypes: {
        serverUrl: React.PropTypes.string,
        defaultTags: React.PropTypes.string,
    },

    componentWillReceiveProps: function(nextProps) {
        this.setState({
            serverUrl: nextProps.serverUrl,
            defaultTags: nextProps.defaultTags
        });

        // TODO: immediately validate potential bad values
        // this.validateForm_()
        // .catch(function(error) {
        //     StatusAction.updateStatus(error.message);
        // })
    },

    getInitialState: function() {
        return {
            serverUrl: this.props.serverUrl,
            defaultTags: this.props.defaultTags,
            tagsInvalid: false
        };
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
        .catch(function(error) {
            StatusAction.updateStatus(error.message);
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

    saveOptions_: function() {
        OptionsActions.saveOptions({
            url: this.state.serverUrl,
            defaultTags: this.state.defaultTags
        });
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

function onDOMContentLoaded() {
    React.render(
        React.createElement(OptionsController, {}), // TODO: disable submit until options are fetched?
        document.getElementById('root')
    );
}

document.addEventListener('DOMContentLoaded', onDOMContentLoaded);