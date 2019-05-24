_override = function (where, name, cb) {
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

define(["vs/code/electron-main/window"], function (win) {
    _override(win.CodeWindow, "doGetUrl", function(original) {
        let res = original();
        res = res.replace("workbench.html", "workbench-monkey-patch.html");
        return res;
    });
});
