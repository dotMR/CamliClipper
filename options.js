function onDOMContentLoaded() {

    React.render(
        React.createElement(OptionsPopup, {}),
        document.getElementById('root')
    );
}

document.addEventListener('DOMContentLoaded', onDOMContentLoaded);