let _override = function (where, name, cb) {
    (function (original) {
        where.prototype[name] = function () {
            let t = this;
            let a = arguments;
            let res = cb.apply(this,
                [() => original.apply(t, a)].concat(a)
            );
            return res;
        }
    })(where.prototype[name]);
}

let _overrideURL = function (win) {
    _override(win.CodeWindow, "doGetUrl", function (original) {
        let res = original();
        res = res.replace("workbench.html", "workbench-monkey-patch.html");
        return res;
    });
};

let updatedRoot = false;

define([], function () {
    require(["vs/code/electron-main/window"], function (win) {
        _overrideURL(win);
    }, function (error) { });

    require(["vs/code/electron-main/protocol", "vs/base/common/uri"], function (protocol, uri) {
        _override(protocol.FileProtocolHandler, "handleFileRequest", function (original) {
            if (!updatedRoot) {
                updatedRoot = true;
                // TODO: Limit this globalStorage
                this.addValidRoot(uri.URI.file('/'))
            }
            return original();
        });
    }, function (error) { });

    require(["vs/platform/windows/electron-main/window"], function (win) {
        _overrideURL(win);
    }, function (error) { });

    require(["vs/base/common/network"], function (network) {
        let orig = network.FileAccess.asBrowserUri;
        network.FileAccess.asBrowserUri = function (url, m) {
            url = url.replace("workbench.html", "workbench-monkey-patch.html");
            let res = orig.apply(this, [url, m]);
            return res;
        }

    }, function (error) { });
});
