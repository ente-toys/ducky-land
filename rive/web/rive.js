(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["rive"] = factory();
	else
		root["rive"] = factory();
})(this, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Animation: () => (/* reexport safe */ _Animation__WEBPACK_IMPORTED_MODULE_0__.Animation)
/* harmony export */ });
/* harmony import */ var _Animation__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2);



/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Animation: () => (/* binding */ Animation)
/* harmony export */ });
/**
 * Represents an animation that can be played on an Artboard.
 * Wraps animations and instances from the runtime and keeps track of playback state.
 *
 * The `Animation` class manages the state and behavior of a single animation instance,
 * including its current time, loop count, and ability to scrub to a specific time.
 *
 * The class provides methods to advance the animation, apply its interpolated keyframe
 * values to the Artboard, and clean up the underlying animation instance when the
 * animation is no longer needed.
 */
var Animation = /** @class */ (function () {
    /**
     * Constructs a new animation
     * @constructor
     * @param {any} animation: runtime animation object
     * @param {any} instance: runtime animation instance object
     */
    function Animation(animation, artboard, runtime, playing) {
        this.animation = animation;
        this.artboard = artboard;
        this.playing = playing;
        this.loopCount = 0;
        /**
         * The time to which the animation should move to on the next render.
         * If not null, the animation will scrub to this time instead of advancing by the given time.
         */
        this.scrubTo = null;
        this.instance = new runtime.LinearAnimationInstance(animation, artboard);
    }
    Object.defineProperty(Animation.prototype, "name", {
        /**
         * Returns the animation's name
         */
        get: function () {
            return this.animation.name;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Animation.prototype, "time", {
        /**
         * Returns the animation's name
         */
        get: function () {
            return this.instance.time;
        },
        /**
         * Sets the animation's current time
         */
        set: function (value) {
            this.instance.time = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Animation.prototype, "loopValue", {
        /**
         * Returns the animation's loop type
         */
        get: function () {
            return this.animation.loopValue;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Animation.prototype, "needsScrub", {
        /**
         * Indicates whether the animation needs to be scrubbed.
         * @returns `true` if the animation needs to be scrubbed, `false` otherwise.
         */
        get: function () {
            return this.scrubTo !== null;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Advances the animation by the give time. If the animation needs scrubbing,
     * time is ignored and the stored scrub value is used.
     * @param time the time to advance the animation by if no scrubbing required
     */
    Animation.prototype.advance = function (time) {
        if (this.scrubTo === null) {
            this.instance.advance(time);
        }
        else {
            this.instance.time = 0;
            this.instance.advance(this.scrubTo);
            this.scrubTo = null;
        }
    };
    /**
     * Apply interpolated keyframe values to the artboard. This should be called after calling
     * .advance() on an animation instance so that new values are applied to properties.
     *
     * Note: This does not advance the artboard, which updates all objects on the artboard
     * @param mix - Mix value for the animation from 0 to 1
     */
    Animation.prototype.apply = function (mix) {
        this.instance.apply(mix);
    };
    /**
     * Deletes the backing Wasm animation instance; once this is called, this
     * animation is no more.
     */
    Animation.prototype.cleanup = function () {
        this.instance.delete();
    };
    return Animation;
}());



/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   RuntimeLoader: () => (/* binding */ RuntimeLoader)
/* harmony export */ });
/* harmony import */ var _rive_advanced_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4);
/* harmony import */ var package_json__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(5);
var __assign = (undefined && undefined.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};


// Runtime singleton; use getInstance to provide a callback that returns the
// Rive runtime
var RuntimeLoader = /** @class */ (function () {
    // Class is never instantiated
    function RuntimeLoader() {
    }
    // Rejects all pending awaitInstance() promises and resets loading state so
    // the next call to getInstance() / awaitInstance() can retry with a new URL.
    RuntimeLoader.notifyError = function (error) {
        var _a;
        RuntimeLoader.isLoading = false;
        while (RuntimeLoader.errorCallbackQueue.length > 0) {
            (_a = RuntimeLoader.errorCallbackQueue.shift()) === null || _a === void 0 ? void 0 : _a(error);
        }
        RuntimeLoader.callBackQueue = [];
    };
    // Loads the runtime
    RuntimeLoader.loadRuntime = function () {
        // Capture the URL at call time so the catch closure always refers to the
        // URL this particular attempt used, even if wasmURL is mutated for a retry.
        var attemptedUrl = RuntimeLoader.wasmURL;
        var wasmBinary = RuntimeLoader.wasmBinary;
        if (RuntimeLoader.enablePerfMarks)
            performance.mark('rive:wasm-init:start');
        _rive_advanced_mjs__WEBPACK_IMPORTED_MODULE_0__["default"](__assign({ 
            // Loads Wasm bundle
            locateFile: function () { return attemptedUrl; } }, (wasmBinary ? { wasmBinary: wasmBinary } : {})))
            .then(function (rive) {
            var _a;
            if (RuntimeLoader.enablePerfMarks) {
                performance.mark('rive:wasm-init:end');
                performance.measure('rive:wasm-init', 'rive:wasm-init:start', 'rive:wasm-init:end');
            }
            RuntimeLoader.runtime = rive;
            RuntimeLoader.errorCallbackQueue = [];
            // Fire all the callbacks
            while (RuntimeLoader.callBackQueue.length > 0) {
                (_a = RuntimeLoader.callBackQueue.shift()) === null || _a === void 0 ? void 0 : _a(RuntimeLoader.runtime);
            }
        })
            .catch(function (error) {
            // Capture specific error details
            var errorDetails = {
                message: (error === null || error === void 0 ? void 0 : error.message) || "Unknown error",
                type: (error === null || error === void 0 ? void 0 : error.name) || "Error",
                // Some browsers may provide additional WebAssembly-specific details
                wasmError: error instanceof WebAssembly.CompileError ||
                    error instanceof WebAssembly.RuntimeError,
                originalError: error,
            };
            // Log detailed error for debugging
            console.debug("Rive WASM load error details:", errorDetails);
            // In case the primary URL fails, or the wasm was not supported, try the
            // fallback URL (a rive_fallback.wasm compiled for older architectures).
            // The fallback can be customised or disabled via setWasmFallbackUrl().
            // TODO: (Gordon): preemptively test browser support and load the correct wasm file. Then use the fallback only if the primary fails.
            var fallbackUrl = RuntimeLoader.wasmFallbackURL;
            var alreadyOnFallback = fallbackUrl !== null &&
                attemptedUrl.toLowerCase() === fallbackUrl.toLowerCase();
            if (fallbackUrl !== null && !alreadyOnFallback) {
                console.warn("Failed to load WASM from ".concat(attemptedUrl, " (").concat(errorDetails.message, "), trying fallback URL: ").concat(fallbackUrl));
                // Clear wasmBinary so the retry actually fetches via locateFile
                // instead of re-using the same (failing) in-memory binary.
                RuntimeLoader.wasmBinary = null;
                RuntimeLoader.setWasmUrl(fallbackUrl);
                RuntimeLoader.loadRuntime();
            }
            else {
                // When alreadyOnFallback is true, wasmURL has already been overwritten
                // with the fallback URL, so we can no longer recover the original
                // primary URL here. The primary URL was logged in the earlier warning.
                var triedUrls = alreadyOnFallback
                    ? "the configured WASM URL or its fallback (".concat(fallbackUrl, ")")
                    : attemptedUrl;
                var errorMessage = [
                    "Could not load Rive WASM file from ".concat(triedUrls, "."),
                    "Possible reasons:",
                    "- Network connection is down",
                    "- WebAssembly is not supported in this environment",
                    "- The WASM file is corrupted or incompatible",
                    "\nError details:",
                    "- Type: ".concat(errorDetails.type),
                    "- Message: ".concat(errorDetails.message),
                    "- WebAssembly-specific error: ".concat(errorDetails.wasmError),
                    "\nTo resolve, you may need to:",
                    "1. Check your network connection",
                    "2. Set a new WASM source via RuntimeLoader.setWasmUrl()",
                    "3. Call RuntimeLoader.awaitInstance() again",
                ].join("\n");
                console.error(errorMessage);
                RuntimeLoader.notifyError(new Error(errorMessage));
            }
        });
    };
    // Provides a runtime instance via a callback
    RuntimeLoader.getInstance = function (callback, onError) {
        // If it's not loading, start loading runtime
        if (!RuntimeLoader.isLoading) {
            RuntimeLoader.isLoading = true;
            RuntimeLoader.loadRuntime();
        }
        if (!RuntimeLoader.runtime) {
            RuntimeLoader.callBackQueue.push(callback);
            if (onError) {
                RuntimeLoader.errorCallbackQueue.push(onError);
            }
        }
        else {
            callback(RuntimeLoader.runtime);
        }
    };
    // Provides a runtime instance via a promise; rejects if WASM fails to load.
    RuntimeLoader.awaitInstance = function () {
        return new Promise(function (resolve, reject) {
            return RuntimeLoader.getInstance(resolve, reject);
        });
    };
    // Manually sets the wasm url
    RuntimeLoader.setWasmUrl = function (url) {
        RuntimeLoader.wasmURL = url;
    };
    // Gets the current wasm url
    RuntimeLoader.getWasmUrl = function () {
        return RuntimeLoader.wasmURL;
    };
    /**
     * Sets the URL used as a fallback when the primary WASM URL fails to load.
     * Pass `null` to disable the fallback entirely.
     *
     * Defaults to pulling from the jsdelivr CDN.
     */
    RuntimeLoader.setWasmFallbackUrl = function (url) {
        RuntimeLoader.wasmFallbackURL = url;
    };
    // Gets the current fallback wasm url (null means fallback is disabled)
    RuntimeLoader.getWasmFallbackUrl = function () {
        return RuntimeLoader.wasmFallbackURL;
    };
    // Manually sets the wasm binary or clears it with null
    RuntimeLoader.setWasmBinary = function (value) {
        if ((value instanceof ArrayBuffer) || value === null) {
            RuntimeLoader.wasmBinary = value;
            return;
        }
        console.error("setWasmBinary expects an ArrayBuffer or null");
    };
    // Gets the current wasm build as ArrayBuffer or null
    RuntimeLoader.getWasmBinary = function () {
        return RuntimeLoader.wasmBinary;
    };
    // Flag to indicate that loading has started/completed
    RuntimeLoader.isLoading = false;
    // List of callbacks for the runtime that come in while loading
    RuntimeLoader.callBackQueue = [];
    // Path to the Wasm file; default path works for testing only;
    // if embedded wasm is used then this is never used.
    RuntimeLoader.wasmURL = "https://unpkg.com/".concat(package_json__WEBPACK_IMPORTED_MODULE_1__.name, "@").concat(package_json__WEBPACK_IMPORTED_MODULE_1__.version, "/rive.wasm");
    // Fallback WASM URL tried when the primary URL fails. Set to null to disable
    // the fallback entirely. Defaults to pulling from the jsdelivr CDN.
    RuntimeLoader.wasmFallbackURL = "https://cdn.jsdelivr.net/npm/".concat(package_json__WEBPACK_IMPORTED_MODULE_1__.name, "@").concat(package_json__WEBPACK_IMPORTED_MODULE_1__.version, "/rive_fallback.wasm");
    RuntimeLoader.wasmBinary = null;
    // Error callbacks enqueued from .getInstance()
    RuntimeLoader.errorCallbackQueue = [];
    /**
     * When true, performance.mark / performance.measure entries are emitted for
     * WASM initialization.
     */
    RuntimeLoader.enablePerfMarks = false;
    return RuntimeLoader;
}());



/***/ }),
/* 4 */
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
var Rive=(()=>{var _scriptName=globalThis.document?.currentScript?.src;return async function(moduleArg={}){var moduleRtn;var I=moduleArg,la=!!globalThis.window,sa=!!globalThis.WorkerGlobalScope;
function ta(){function d(D){const F=q;l=e=0;q=new Map;F.forEach(J=>{try{J(D)}catch(N){console.error(N)}});this.lb();z&&z.Zb()}let e=0,l=0,q=new Map,z=null,C=null;this.requestAnimationFrame=function(D){e||=requestAnimationFrame(d.bind(this));const F=++l;q.set(F,D);return F};this.cancelAnimationFrame=function(D){q.delete(D);e&&0==q.size&&(cancelAnimationFrame(e),e=0)};this.Tb=function(D){C&&(document.body.remove(C),C=null);D||(C=document.createElement("div"),C.style.backgroundColor="black",C.style.position=
"fixed",C.style.right=0,C.style.top=0,C.style.color="white",C.style.padding="4px",C.innerHTML="RIVE FPS",D=function(F){C.innerHTML="RIVE FPS "+F.toFixed(1)},document.body.appendChild(C));z=new function(){let F=0,J=0;this.Zb=function(){var N=performance.now();J?(++F,N-=J,1E3<N&&(D(1E3*F/N),F=J=0)):(J=N,F=0)}}};this.lb=function(){}}
function xa(){console.assert(!0);const d=new Map;let e=-Infinity;this.push=function(l){l=l+255>>8;d.has(l)&&clearTimeout(d.get(l));d.set(l,setTimeout(function(){d.delete(l);0==d.length?e=-Infinity:l==e&&(e=Math.max(...d.keys()),console.assert(e<l))},1E3));e=Math.max(l,e);return e<<8}}function ya(d){return function(){d();const e=I.riveScripting;if(e)for(const l of e.frameBoundary())console.warn(l)}}const Da=I.onRuntimeInitialized;
I.onRuntimeInitialized=function(){Da&&Da();I.startFileScripts=function(D){const F=I.riveScripting;return D&&F&&D.startScripts?F.prepare().then(function(){D.startScripts();return D}):Promise.resolve(D)};let d=I.decodeAudio;I.decodeAudio=function(D,F,J=null){D=d(D,J??null);F(D)};let e=I.decodeFont;I.decodeFont=function(D,F,J=null){D=e(D,J??null);F(D)};const l=I.FileAsset.prototype.decode;I.FileAsset.prototype.decode=function(D,F){return l.call(this,D,F??null)};let q=I.setFallbackFontCb;I.setFallbackFontCallback=
"function"===typeof q?function(D){q(D)}:function(){console.warn("Module.setFallbackFontCallback called, but text support is not enabled in this build.")};const z=I.FileAssetLoader;I.ptrToAsset=D=>{let F=I.ptrToFileAsset(D);return F.isImage?I.ptrToImageAsset(D):F.isFont?I.ptrToFontAsset(D):F.isAudio?I.ptrToAudioAsset(D):F};I.CustomFileAssetLoader=z.extend("CustomFileAssetLoader",{__construct:function({loadContents:D}){this.__parent.__construct.call(this);this.Cb=D},loadContents:function(D,F){D=I.ptrToAsset(D);
return this.Cb(D,F)}});I.CDNFileAssetLoader=z.extend("CDNFileAssetLoader",{__construct:function(D){this.__parent.__construct.call(this);this.Eb=D??null},loadContents:function(D){let F=I.ptrToAsset(D);D=F.cdnUuid;if(""===D)return!1;const J=this.Eb??null;(function(N,R){var T=new XMLHttpRequest;T.responseType="arraybuffer";T.onreadystatechange=function(){4==T.readyState&&200==T.status&&R(T)};T.open("GET",N,!0);T.send(null)})(F.cdnBaseUrl+"/"+D,N=>{F.decode(new Uint8Array(N.response),J)});return!0}});
I.FallbackFileAssetLoader=z.extend("FallbackFileAssetLoader",{__construct:function(){this.__parent.__construct.call(this);this.jb=[]},addLoader:function(D){this.jb.push(D)},loadContents:function(D,F){for(let J of this.jb)if(J.loadContents(D,F))return!0;return!1}});let C=I.computeAlignment;I.computeAlignment=function(D,F,J,N,R=1){return C.call(this,D,F,J,N,R)}};
(function(){function d(r,a,f=null){const c=r.Lb,n=r.la,p=r.ka,v=r.wa??{i:!1};let k=null;const b=()=>{const A=a().buffer;if(null===k||k.buffer!==A)k=new Uint8Array(A);return k},g=(A,w)=>{if(0>w||(A>>>0)+w>b().length)throw new RangeError("module range out of bounds");A=4096<w?r.Ta(w):r.Ea(w);if(0===A)throw Error(`could not stage ${w} bytes for the host`);return A},h=(A,w)=>{const t=g(A,w);A>>>=0;r.W().set(k.subarray(A,A+w),t);v.i&&(v.ua+=w);return t},m=(A,w)=>{0!==A&&4096<w&&r.ca(A)},x=(A,w,t)=>{0!==
t&&(b().set(r.W().subarray(A,A+t),w>>>0),v.i&&(v.sa+=t))},K=(A,w)=>{const t=z(a().buffer,A),y=n();let u=0;try{u=h(A,t),w(u,t)}finally{m(u,t),p(y)}},S=A=>w=>K(w,(t,y)=>c.Xd(A,t,y));return{env:{seed:()=>Date.now()*Math.random(),emscripten_get_now:()=>performance.now(),emscripten_date_now:()=>Date.now(),trace:(A,w,t,y,u,E,M)=>K(A,(P,pa)=>c.aj(P,pa,w,t,y,u,E,M)),"console.log":S(0),"console.debug":S(0),"console.info":S(0),"console.warn":S(0),"console.error":S(0),"console.time":S(1),"console.timeLog":S(2),
"console.timeEnd":S(3)},rive_rt_v1:(null===f||"rive_rt_v1"===f)&&{log:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t),c.$h(A,u,t)}finally{m(u,t),p(y)}},mark_needs_update:c.ai,budget_exceeded:c.Uh,error:(A,w)=>{const t=n();let y=0;try{y=h(A,w),c.Yh(y,w)}finally{m(y,w),p(t)}},now:()=>performance.now(),date_now:()=>Date.now(),debug_enter:c.Vh,debug_line:c.Xh,debug_leave:c.Wh,utc_offset:c.bi,is_dst:c.Zh,zone_name:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t);const E=c.ci(A,u,t);x(u,w,t);return E}finally{m(u,
t),p(y)}}},rive_data_v1:(null===f||"rive_data_v1"===f)&&{view_model:c.Te,root_view_model:c.Ne,global_view_model:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.te(A,u,t)}finally{m(u,t),p(y)}},global_view_model_names:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t);const E=c.ue(A,u,t);x(u,w,t);return E}finally{m(u,t),p(y)}},context:c.ie,context_parent:c.je,context_view_model:c.le,context_release:c.ke,has_view_model:(A,w)=>{const t=n();let y=0;try{return y=h(A,w),c.ve(y,w)}finally{m(y,w),p(t)}},new_view_model:(A,
w,t,y)=>{const u=n();let E=0,M=0;try{return E=h(A,w),M=h(t,y),c.Je(E,w,M,y)}finally{m(M,y),m(E,w),p(u)}},vmi_release:c.hf,vmi_number:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.ff(A,u,t)}finally{m(u,t),p(y)}},vmi_boolean:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.Ye(A,u,t)}finally{m(u,t),p(y)}},vmi_string:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.jf(A,u,t)}finally{m(u,t),p(y)}},vmi_trigger:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.lf(A,u,t)}finally{m(u,t),p(y)}},
vmi_color:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.Ze(A,u,t)}finally{m(u,t),p(y)}},vmi_view_model:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.mf(A,u,t)}finally{m(u,t),p(y)}},vmi_property:(A,w,t,y,u)=>{const E=n();let M=0,P=0;try{M=h(w,t);P=h(y,4*u);const pa=c.gf(A,M,t,P,u);x(P,y,4*u);return pa}finally{m(P,4*u),m(M,t),p(E)}},vmi_instance:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.df(A,u,t)}finally{m(u,t),p(y)}},vmi_symbol_index:c.kf,vmi_equal:c.af,view_model_get:c.Ue,vmi_list:(A,
w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.ef(A,u,t)}finally{m(u,t),p(y)}},vmi_enum:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.$e(A,u,t)}finally{m(u,t),p(y)}},vmi_image:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.cf(A,u,t)}finally{m(u,t),p(y)}},vmi_font:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.bf(A,u,t)}finally{m(u,t),p(y)}},vmi_blob:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.Xe(A,u,t)}finally{m(u,t),p(y)}},vmi_artboard:(A,w,t)=>{const y=n();let u=0;try{return u=
h(w,t),c.We(A,u,t)}finally{m(u,t),p(y)}},image_get:c.we,image_set:c.xe,font_get:c.qe,font_set:c.se,font_release:c.re,blob_present:c.ce,blob_get:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t);const E=c.ae(A,u,t);x(u,w,t);return E}finally{m(u,t),p(y)}},blob_name:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t);const E=c.be(A,u,t);x(u,w,t);return E}finally{m(u,t),p(y)}},blob_set:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t),c.de(A,u,t)}finally{m(u,t),p(y)}},blob_clear:c.$d,artboard_get:c.Yd,artboard_set:c.Zd,enum_get:(A,
w,t)=>{const y=n();let u=0;try{u=h(w,t);const E=c.ne(A,u,t);x(u,w,t);return E}finally{m(u,t),p(y)}},enum_set:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t),c.oe(A,u,t)}finally{m(u,t),p(y)}},enum_values:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t);const E=c.pe(A,u,t);x(u,w,t);return E}finally{m(u,t),p(y)}},prop_release:c.Me,trigger_fire:c.Re,list_length:c.Be,list_push:c.De,list_pop:c.Ce,list_shift:c.He,list_clear:c.ye,list_swap:c.Ie,list_insert:c.Ae,list_remove:c.Ee,list_remove_at:c.Ge,list_remove_all_of:c.Fe,
list_get:c.ze,view_model_set:c.Ve,color_get:c.ge,color_set:c.he,number_get:c.Ke,number_set:c.Le,boolean_get:c.ee,boolean_set:c.fe,string_get:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t);const E=c.Pe(A,u,t);x(u,w,t);return E}finally{m(u,t),p(y)}},string_changed:c.Oe,string_set:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t),c.Qe(A,u,t)}finally{m(u,t),p(y)}},watch:c.nf,unwatch:c.Se,convert_result:(A,w,t,y,u,E)=>{const M=n();let P=0;try{P=h(u,E),c.me(A,w,t,y,P,E)}finally{m(P,E),p(M)}}},rive_artboard_v1:(null===
f||"rive_artboard_v1"===f)&&{release:c.fd,advance:c.zc,draw:c.Hc,instance:c.Rc,data:c.Gc,width:c.ld,height:c.Qc,set_width:c.kd,set_height:c.jd,frame_origin:c.Oc,set_frame_origin:c.hd,bounds:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t),c.Fc(A,u,t),x(u,w,4*t)}finally{m(u,4*t),p(y)}},pointer_event:c.dd,scroll_event:c.gd,gamepad_event:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.Pc(A,u,t)}finally{m(u,t),p(y)}},animation:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.Ac(A,u,t)}finally{m(u,
t),p(y)}},animation_release:c.Dc,animation_duration:c.Cc,animation_advance:c.Bc,animation_set_time:c.Ec,add_to_path:c.yc,node:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.Sc(A,u,t)}finally{m(u,t),p(y)}},node_release:c.Zc,node_transform:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t),c.bd(A,u,t),x(u,w,4*t)}finally{m(u,4*t),p(y)}},node_set:c.$c,node_world_transform:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t),c.cd(A,u,t),x(u,w,4*t)}finally{m(u,4*t),p(y)}},node_set_world_transform:(A,w,t)=>{const y=
n();let u=0;try{u=h(w,4*t),c.ad(A,u,t)}finally{m(u,4*t),p(y)}},node_decompose:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t),c.Uc(A,u,t)}finally{m(u,4*t),p(y)}},node_path_verbs:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t);const E=c.Yc(A,u,t);x(u,w,t);return E}finally{m(u,t),p(y)}},node_path_points:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t);const E=c.Xc(A,u,t);x(u,w,4*t);return E}finally{m(u,4*t),p(y)}},node_paint:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t);const E=c.Vc(A,u,t);x(u,w,4*t);return E}finally{m(u,
4*t),p(y)}},node_children:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t);const E=c.Tc(A,u,t);x(u,w,4*t);return E}finally{m(u,4*t),p(y)}},node_parent:c.Wc,property_key:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.ed(A,u,t)}finally{m(u,t),p(y)}},draw_visit:c.Jc,draw_modulated:c.Ic,drawable_draw:c.Kc,drawable_value:(A,w,t,y)=>{const u=n();let E=0;try{E=h(t,4*y);const M=c.Nc(A,w,E,y);x(E,t,4*y);return M}finally{m(E,4*y),p(u)}},drawable_string:(A,w,t,y)=>{const u=n();let E=0;try{E=h(t,y);const M=
c.Mc(A,w,E,y);x(E,t,y);return M}finally{m(E,y),p(u)}},drawable_properties:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t);const E=c.Lc(A,u,t);x(u,w,t);return E}finally{m(u,t),p(y)}}},rive_audio_v1:(null===f||"rive_audio_v1"===f)&&{source:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.Ed(A,u,t)}finally{m(u,t),p(y)}},source_release:c.Hd,source_duration:c.Gd,source_sample_rate:c.Id,source_channels:c.Fd,play:c.md,play_at_time:c.od,play_in_time:c.qd,play_at_frame:c.nd,play_in_frame:c.pd,time:c.Jd,time_frame:c.Kd,
sample_rate:c.rd,sound_release:c.vd,sound_play:c.ud,sound_pause:c.td,sound_resume:c.wd,sound_stop:c.Ad,sound_seek:c.xd,sound_seek_frame:c.yd,sound_completed:c.sd,sound_time:c.Bd,sound_time_frame:c.Cd,sound_volume:c.Dd,sound_set_volume:c.zd},rive_path_v1:(null===f||"rive_path_v1"===f)&&{"new":c.Fh,update:(A,w,t,y,u,E)=>{const M=n();let P=0,pa=0;try{P=h(w,t),pa=h(y,4*u),c.Ih(A,P,t,pa,u,E)}finally{m(pa,4*u),m(P,t),p(M)}},release:c.Hh,add:c.Dh,verbs:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t);const E=
c.Jh(A,u,t);x(u,w,t);return E}finally{m(u,t),p(y)}},points:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t);const E=c.Gh(A,u,t);x(u,w,4*t);return E}finally{m(u,4*t),p(y)}},effect_result:(A,w,t,y)=>{const u=n();let E=0,M=0;try{E=h(A,w),M=h(t,4*y),c.Eh(E,w,M,y)}finally{m(M,4*y),m(E,w),p(u)}}},rive_measure_v1:(null===f||"rive_measure_v1"===f)&&{path_new:(A,w,t,y)=>{const u=n();let E=0,M=0;try{return E=h(A,w),M=h(t,4*y),c.ih(E,w,M,y)}finally{m(M,4*y),m(E,w),p(u)}},contours_new:(A,w,t,y)=>{const u=n();let E=
0,M=0;try{return E=h(A,w),M=h(t,4*y),c.dh(E,w,M,y)}finally{m(M,4*y),m(E,w),p(u)}},contour_next:c.bh,length:c.hh,is_closed:c.gh,pos_tan:(A,w,t,y)=>{const u=n();let E=0;try{E=h(t,4*y),c.jh(A,w,E,y),x(E,t,4*y)}finally{m(E,4*y),p(u)}},warp:(A,w,t,y,u)=>{const E=n();let M=0;try{M=h(y,4*u),c.lh(A,w,t,M,u),x(M,y,4*u)}finally{m(M,4*u),p(E)}},extract:c.eh,extract_read:(A,w,t,y,u)=>{const E=n();let M=0,P=0;try{M=h(w,t);P=h(y,4*u);const pa=c.fh(A,M,t,P,u);x(M,w,t);x(P,y,4*u);return pa}finally{m(P,4*u),m(M,t),
p(E)}},release:c.kh},rive_paint_v1:(null===f||"rive_paint_v1"===f)&&{"new":c.xh,release:c.yh,style:c.Bh,color:c.uh,thickness:c.Ch,join:c.wh,cap:c.th,blend_mode:c.sh,feather:c.vh,shader:c.zh,shader_transform:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t),c.Ah(A,u,t)}finally{m(u,4*t),p(y)}}},rive_canvas_v1:(null===f||"rive_canvas_v1"===f)&&{"new":c.Td,release:c.Ud,width:c.Wd,height:c.Rd,resize:c.Vd,image:c.Sd,begin_frame:c.Pd,end_frame:c.Qd},rive_gpu_v1:(null===f||"rive_gpu_v1"===f)&&{features:(A,w)=>
{const t=n();let y=0;try{y=h(A,4*w);const u=c.cg(y,w);x(y,A,4*w);return u}finally{m(y,4*w),p(t)}},canvas_new:c.$f,canvas_release:c.ag,canvas_color_view:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t);const E=c.Yf(A,u,t);x(u,w,4*t);return E}finally{m(u,4*t),p(y)}},canvas_image:c.Zf,canvas_resize:(A,w,t,y,u)=>{const E=n();let M=0;try{M=h(y,4*u);const P=c.bg(A,w,t,M,u);x(M,y,4*u);return P}finally{m(M,4*u),p(E)}},target_view:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t);const E=c.Bg(A,u,t);x(u,w,4*t);return E}finally{m(u,
4*t),p(y)}},pass_begin:(A,w,t,y)=>{const u=n();let E=0,M=0;try{return E=h(A,w),M=h(t,y),c.eg(E,w,M,y)}finally{m(M,y),m(E,w),p(u)}},pass_set_pipeline:c.mg,pass_set_vertex_buffer:c.pg,pass_set_index_buffer:c.lg,pass_set_bind_group:(A,w,t,y,u)=>{const E=n();let M=0;try{M=h(y,u),c.jg(A,w,t,M,u)}finally{m(M,u),p(E)}},pass_set_viewport:c.qg,pass_set_scissor:c.ng,pass_set_stencil_reference:c.og,pass_set_blend_color:c.kg,pass_draw:c.fg,pass_draw_indexed:c.gg,pass_finish:c.hg,pass_release:c.ig,image_view:c.dg,
buffer_new:(A,w,t,y,u)=>{const E=n();let M=0;try{return M=h(y,u),c.Tf(A,w,t,M,u)}finally{m(M,u),p(E)}},buffer_update:(A,w,t,y)=>{const u=n();let E=0;try{E=h(t,y),c.Wf(A,w,E,y)}finally{m(E,y),p(u)}},buffer_update_blob:c.Xf,buffer_new_blob:c.Uf,buffer_release:c.Vf,texture_new:(A,w)=>{const t=n();let y=0;try{return y=h(A,w),c.Cg(y,w)}finally{m(y,w),p(t)}},texture_upload:(A,w,t,y,u)=>{const E=n();let M=0,P=0;try{M=h(w,t),P=h(y,u),c.Eg(A,M,t,P,u)}finally{m(P,u),m(M,t),p(E)}},texture_release:c.Dg,sampler_new:(A,
w)=>{const t=n();let y=0;try{return y=h(A,w),c.tg(y,w)}finally{m(y,w),p(t)}},sampler_release:c.ug,texture_view_new:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.Fg(A,u,t)}finally{m(u,t),p(y)}},texture_view_release:c.Gg,shader_target:c.Ag,shader_asset_bytes:(A,w,t,y,u)=>{const E=n();let M=0,P=0;try{M=h(w,t);P=h(y,u);const pa=c.vg(A,M,t,P,u);x(P,y,u);return pa}finally{m(P,u),m(M,t),p(E)}},shader_asset_id:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.wg(A,u,t)}finally{m(u,t),p(y)}},shader_module_from_asset:(A,
w,t,y)=>{const u=n();let E=0;try{return E=h(w,t),c.xg(A,E,t,y)}finally{m(E,t),p(u)}},shader_module_from_rstb:(A,w,t,y)=>{const u=n();let E=0;try{return E=h(A,w),c.yg(E,w,t,y)}finally{m(E,w),p(u)}},shader_module_release:c.zg,bind_group_layout_new:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.Pf(A,u,t)}finally{m(u,t),p(y)}},bind_group_layout_release:c.Qf,bind_group_layout_from_shader:(A,w,t,y)=>{const u=n();let E=0;try{return E=h(t,4*y),c.Nf(A,w,E,y)}finally{m(E,4*y),p(u)}},bind_group_layout_from_shaders:(A,
w,t,y,u)=>{const E=n();let M=0;try{return M=h(y,4*u),c.Of(A,w,t,M,u)}finally{m(M,4*u),p(E)}},bind_group_layout_from_entries:(A,w,t,y,u,E,M)=>{const P=n();let pa=0,Ba=0;try{return pa=h(w,t),Ba=h(u,E),c.Mf(A,pa,t,y,Ba,E,M)}finally{m(Ba,E),m(pa,t),p(P)}},bind_group_new:(A,w,t,y,u,E,M)=>{const P=n();let pa=0,Ba=0,Ka=0;try{return pa=h(w,t),Ba=h(y,u),Ka=h(E,M),c.Rf(A,pa,t,Ba,u,Ka,M)}finally{m(Ka,M),m(Ba,u),m(pa,t),p(P)}},bind_group_release:c.Sf,pipeline_new:(A,w,t,y)=>{const u=n();let E=0,M=0;try{return E=
h(A,w),M=h(t,y),c.rg(E,w,M,y)}finally{m(M,y),m(E,w),p(u)}},pipeline_release:c.sg},rive_mat4_v1:(null===f||"rive_mat4_v1"===f)&&{multiply:(A,w,t,y,u,E)=>{const M=n();let P=0,pa=0,Ba=0;try{P=h(A,w),pa=h(t,y),Ba=h(u,E),c.ah(P,w,pa,y,Ba,E),x(P,A,w)}finally{m(Ba,E),m(pa,y),m(P,w),p(M)}},invert:(A,w,t,y)=>{const u=n();let E=0,M=0;try{E=h(A,w);M=h(t,y);const P=c.$g(E,w,M,y);x(E,A,w);return P}finally{m(M,y),m(E,w),p(u)}}},rive_buffer_v1:(null===f||"rive_buffer_v1"===f)&&{"new":c.Md,update:(A,w,t)=>{const y=
n();let u=0;try{u=h(w,t),c.Od(A,u,t)}finally{m(u,t),p(y)}},release:c.Nd},rive_mesh_instances_v1:(null===f||"rive_mesh_instances_v1"===f)&&{"new":c.mh,resize:c.oh,update:(A,w,t,y)=>{const u=n();let E=0;try{E=h(t,y),c.ph(A,w,E,y)}finally{m(E,y),p(u)}},release:c.nh},rive_blob_v1:(null===f||"rive_blob_v1"===f)&&{asset_bytes:(A,w,t,y,u)=>{const E=n();let M=0,P=0;try{M=h(w,t);P=h(y,u);const pa=c.Ld(A,M,t,P,u);x(P,y,u);return pa}finally{m(P,u),m(M,t),p(E)}}},rive_image_v1:(null===f||"rive_image_v1"===f)&&
{from_asset:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.Jg(A,u,t)}finally{m(u,t),p(y)}},width:c.Mg,height:c.Kg,release:c.Lg,decode:(A,w,t)=>{const y=n();let u=0;try{return u=h(A,w),c.Hg(u,w,t)}finally{m(u,w),p(y)}},decode_cancel:c.Ig},rive_font_v1:(null===f||"rive_font_v1"===f)&&{from_asset:(A,w,t)=>{const y=n();let u=0;try{return u=h(w,t),c.Df(A,u,t)}finally{m(u,t),p(y)}},decode:(A,w)=>{const t=n();let y=0;try{return y=h(A,w),c.Bf(y,w)}finally{m(y,w),p(t)}},release:c.Jf,metrics:(A,w,t)=>
{const y=n();let u=0;try{u=h(w,4*t),c.If(A,u,t),x(u,w,4*t)}finally{m(u,4*t),p(y)}},weight:c.Kf,is_italic:c.Hf,axis_count:c.zf,axis:(A,w,t,y)=>{const u=n();let E=0;try{E=h(t,4*y),c.yf(A,w,E,y),x(E,t,4*y)}finally{m(E,4*y),p(u)}},axis_value:c.Af,features:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t);const E=c.Cf(A,u,t);x(u,w,4*t);return E}finally{m(u,4*t),p(y)}},has_glyph:c.Gf,with_options:(A,w,t,y,u)=>{const E=n();let M=0,P=0;try{return M=h(w,4*t),P=h(y,4*u),c.Lf(A,M,t,P,u)}finally{m(P,4*u),m(M,4*t),
p(E)}},glyph_verbs:(A,w,t,y)=>{const u=n();let E=0;try{E=h(t,y);const M=c.Ff(A,w,E,y);x(E,t,y);return M}finally{m(E,y),p(u)}},glyph_points:(A,w,t,y)=>{const u=n();let E=0;try{E=h(t,4*y);const M=c.Ef(A,w,E,y);x(E,t,4*y);return M}finally{m(E,4*y),p(u)}}},rive_text_v1:(null===f||"rive_text_v1"===f)&&{"new":c.Xi,release:c.Yi,append:(A,w,t,y,u,E,M,P,pa)=>{const Ba=n();let Ka=0;try{Ka=h(w,t),c.Ni(A,Ka,t,y,u,E,M,P,pa)}finally{m(Ka,t),p(Ba)}},clear:c.Qi,layout:(A,w,t)=>{const y=n();let u=0;try{u=h(w,t),c.Ui(A,
u,t)}finally{m(u,t),p(y)}},draw:c.Ri,bounds:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t),c.Oi(A,u,t),x(u,w,4*t)}finally{m(u,4*t),p(y)}},length:c.Vi,lines:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t);const E=c.Wi(A,u,t);x(u,w,4*t);return E}finally{m(u,4*t),p(y)}},runs:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t);const E=c.Zi(A,u,t);x(u,w,4*t);return E}finally{m(u,4*t),p(y)}},glyphs:(A,w,t)=>{const y=n();let u=0;try{u=h(w,4*t);const E=c.Si(A,u,t);x(u,w,4*t);return E}finally{m(u,4*t),p(y)}},hit_test:c.Ti,
caret:(A,w,t,y)=>{const u=n();let E=0;try{E=h(t,4*y);const M=c.Pi(A,w,E,y);x(E,t,4*y);return M}finally{m(E,4*y),p(u)}},selection_rects:(A,w,t,y,u)=>{const E=n();let M=0;try{M=h(y,4*u);const P=c.$i(A,w,t,M,u);x(M,y,4*u);return P}finally{m(M,4*u),p(E)}}},rive_shader_v1:(null===f||"rive_shader_v1"===f)&&{linear:c.di,radial:c.ei,release:c.fi},rive_test_v1:(null===f||"rive_test_v1"===f)&&{blob:(A,w,t,y)=>{const u=n();let E=0,M=0;try{E=h(A,w);M=h(t,y);const P=c.Mi(E,w,M,y);x(M,t,y);return P}finally{m(M,
y),m(E,w),p(u)}}},rive_transition_v1:(null===f||"rive_transition_v1"===f)&&{child_draw:c.bj,child_width:c.dj,child_height:c.cj},rive_renderer_v1:(null===f||"rive_renderer_v1"===f)&&{save:c.Sh,restore:c.Rh,transform:c.Th,draw_path:c.Oh,clip_path:c.Kh,modulate_opacity:c.Qh,modulate_color:c.Ph,draw_image:c.Lh,draw_image_mesh:c.Mh,draw_image_mesh_instanced:c.Nh},rive_net_v1:(null===f||"rive_net_v1"===f)&&{fetch:(A,w,t)=>{const y=n();let u=0;try{return u=h(A,w),c.qh(u,w,t)}finally{m(u,w),p(y)}},fetch_cancel:c.rh},
rive_file_v1:(null===f||"rive_file_v1"===f)&&{decode:(A,w,t,y)=>{const u=n();let E=0,M=0;try{E=h(A,w);M=h(t,4*y);const P=c.wf(E,w,M,y);x(M,t,4*y);return P}finally{m(M,4*y),m(E,w),p(u)}},release:c.xf,artboard_count:c.pf,artboard_name:(A,w,t,y)=>{const u=n();let E=0;try{E=h(t,y);const M=c.qf(A,w,E,y);x(E,t,y);return M}finally{m(E,y),p(u)}},bindable:(A,w,t,y)=>{const u=n();let E=0;try{return E=h(w,t),c.rf(A,E,t,y)}finally{m(E,t),p(u)}},bindable_release:c.vf,bindable_name:(A,w,t)=>{const y=n();let u=
0;try{u=h(w,t);const E=c.uf(A,u,t);x(u,w,t);return E}finally{m(u,t),p(y)}},bindable_data:c.sf,bindable_equal:c.tf},rive_lanes_v1:(null===f||"rive_lanes_v1"===f)&&{start:(A,w,t,y,u,E)=>{const M=n();let P=0,pa=0;try{return P=h(t,y),pa=h(u,4*E),c.Ug(A,w,P,y,pa,E)}finally{m(pa,4*E),m(P,y),p(M)}},state:c.Vg,failed:(A,w,t)=>{const y=n();let u=0;try{u=g(w,t);const E=c.Rg(A,u,t);x(u,w,E>>>0<=t?E>>>0:0);return E}finally{m(u,t),p(y)}},stop:c.Wg,release:c.Sg,result:c.Tg,watch:c.Zg,wait:c.Xg,cancel_wait:c.Qg,
wait_within:c.Yg},rive_jobs_v1:(null===f||"rive_jobs_v1"===f)&&{threads:c.Pg,join:c.Ng,join_any:(A,w,t)=>{const y=n();let u=0;try{return u=h(A,4*w),c.Og(u,w,t)}finally{m(u,4*w),p(y)}}},rive_shared_v1:(null===f||"rive_shared_v1"===f)&&{region_create:c.pi,region_size:c.ui,region_lock:c.ri,region_unlock:c.vi,region_read:(A,w,t,y)=>{const u=n();let E=0;try{E=g(t,y);const M=c.ti(A,w,E,y);x(E,t,0!==M?y:0);return M}finally{m(E,y),p(u)}},region_write:(A,w,t,y)=>{const u=n();let E=0;try{return E=h(t,y),c.wi(A,
w,E,y)}finally{m(E,y),p(u)}},region_poisoned:c.si,atomic_load:c.ii,atomic_store:c.ki,atomic_add:c.gi,atomic_cas:c.hi,ring_create:c.zi,ring_write:(A,w,t,y,u)=>{const E=n();let M=0,P=0;try{return M=h(w,t),P=h(y,4*u),c.Ei(A,M,t,P,u)}finally{m(P,4*u),m(M,t),p(E)}},ring_read:(A,w,t)=>{const y=n();let u=0;try{u=g(w,t);const E=c.Bi(A,u,t);A=E-1;x(u,w,A>>>0<=t?A>>>0:0);return E}finally{m(u,t),p(y)}},ring_drop:c.Ai,ring_used:c.Di,ring_signal:c.Ci,snapshot_create:c.Ii,snapshot_publish:(A,w,t,y,u)=>{const E=
n();let M=0,P=0;try{return M=h(w,t),P=h(y,4*u),c.Ji(A,M,t,P,u)}finally{m(P,4*u),m(M,t),p(E)}},snapshot_read:(A,w,t)=>{const y=n();let u=0;try{u=g(w,t);const E=c.Ki(A,u,t);A=E-1;x(u,w,A>>>0<=t?A>>>0:0);return E}finally{m(u,t),p(y)}},snapshot_seq:c.Li,read_done:c.oi,signal_create:c.Fi,signal_notify:c.Gi,signal_seq:c.Hi,blob_create:(A,w)=>{const t=n();let y=0;try{return y=h(A,w),c.li(y,w)}finally{m(y,w),p(t)}},blob_size:c.ni,blob_read:(A,w,t,y)=>{const u=n();let E=0;try{E=g(t,y);const M=c.mi(A,w,E,y);
x(E,t,M>>>0<=y?M>>>0:0);return M}finally{m(E,y),p(u)}},retain:c.yi,release:c.xi}}}function e(r,a,f=null){const c=a.wa??{i:!1},n=()=>{const k=Error(a.j);a.j=null;throw k;},p=()=>{throw Error("librive faulted in a nested script call");},v=()=>{throw Error("script VM was released");};return{$h:(null===f||"rive_rt_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(0)),ai:(null===f||"rive_rt_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;
try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(1)),Uh:(null===f||"rive_rt_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(2)),Yh:(null===f||"rive_rt_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(3)),Vh:(null===f||"rive_rt_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(4)),
Xh:(null===f||"rive_rt_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(5)),Wh:(null===f||"rive_rt_v1"===f)&&(k=>()=>{0===a.g&&v();c.i&&c.l++;try{k(a.g)}catch(g){var b=g;a.h=!0;throw b;}a.h&&p();null!==a.j&&n()})(r(6)),bi:(null===f||"rive_rt_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(7)),Zh:(null===f||"rive_rt_v1"===f)&&(k=>b=>{0===
a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(8)),ci:(null===f||"rive_rt_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(9)),Te:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(10)),Ne:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;
let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(11)),te:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(12)),ue:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(13)),ie:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;
try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(14)),je:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(15)),le:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(16)),ke:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=
g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(17)),ve:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(18)),Je:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(19)),hf:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();
null!==a.j&&n()})(r(20)),ff:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(21)),Ye:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(22)),jf:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();
null!==a.j&&n();return m})(r(23)),lf:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(24)),Ze:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(25)),mf:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&
p();null!==a.j&&n();return m})(r(26)),gf:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;let K;try{K=k(a.g,b,g,h,m,x)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n();return K})(r(27)),df:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(28)),kf:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;
}a.h&&p();null!==a.j&&n();return g})(r(29)),af:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(30)),Ue:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(31)),ef:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&
p();null!==a.j&&n();return m})(r(32)),$e:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(33)),cf:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(34)),bf:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,
b;}a.h&&p();null!==a.j&&n();return m})(r(35)),Xe:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(36)),We:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(37)),we:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;
}a.h&&p();null!==a.j&&n();return g})(r(38)),xe:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(39)),qe:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(40)),se:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(41)),
re:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(42)),ce:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(43)),ae:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(44)),be:(null===f||"rive_data_v1"===
f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(45)),de:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(46)),$d:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(47)),Yd:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;
let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(48)),Zd:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(49)),ne:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(50)),oe:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=
m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(51)),pe:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(52)),Me:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(53)),Re:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(54)),
Be:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(55)),De:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(56)),Ce:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(57)),He:(null===f||"rive_data_v1"===f)&&
(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(58)),ye:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(59)),Ie:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(60)),Ae:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,
b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(61)),Ee:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(62)),Ge:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(63)),Fe:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&
n()})(r(64)),ze:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(65)),Ve:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(66)),ge:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(67)),he:(null===f||
"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(68)),Ke:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(69)),Le:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(70)),ee:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&
c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(71)),fe:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(72)),Pe:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(73)),Oe:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,
b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(74)),Qe:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(75)),nf:(null===f||"rive_data_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(76)),Se:(null===f||"rive_data_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==
a.j&&n()})(r(77)),me:(null===f||"rive_data_v1"===f)&&(k=>(b,g,h,m,x,K)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x,K)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(78)),fd:(null===f||"rive_artboard_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(79)),zc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(80)),Hc:(null===
f||"rive_artboard_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(81)),Rc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(82)),Gc:(null===f||"rive_artboard_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(83)),ld:(null===f||"rive_artboard_v1"===
f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(84)),Qc:(null===f||"rive_artboard_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(85)),kd:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(86)),jd:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g)=>{0===
a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(87)),Oc:(null===f||"rive_artboard_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(88)),hd:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(89)),Fc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,
b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(90)),dd:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;let K;try{K=k(a.g,b,g,h,m,x)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n();return K})(r(91)),gd:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h,m,x,K,S,A,w)=>{0===a.g&&v();c.i&&c.l++;let t;try{t=k(a.g,b,g,h,m,x,K,S,A,w)}catch(y){throw b=y,a.h=!0,b;}a.h&&p();null!==a.j&&n();return t})(r(92)),Pc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>
{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(93)),Ac:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(94)),Dc:(null===f||"rive_artboard_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(95)),Cc:(null===f||"rive_artboard_v1"===f)&&(k=>b=>{0===a.g&&v();
c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(96)),Bc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(97)),Ec:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(98)),yc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h,m,x,K,S,A)=>{0===a.g&&
v();c.i&&c.l++;try{k(a.g,b,g,h,m,x,K,S,A)}catch(w){throw b=w,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(99)),Sc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(100)),Zc:(null===f||"rive_artboard_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(101)),bd:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;
try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(102)),$c:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(103)),cd:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(104)),ad:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=
m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(105)),Uc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(106)),Yc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(107)),Xc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,
a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(108)),Vc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(109)),Tc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(110)),Wc:(null===f||"rive_artboard_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=
h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(111)),ed:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(112)),Jc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(113)),Ic:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=
!0,b;}a.h&&p();null!==a.j&&n()})(r(114)),Kc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(115)),Nc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(116)),Mc:(null===f||"rive_artboard_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=
!0,b;}a.h&&p();null!==a.j&&n();return x})(r(117)),Lc:(null===f||"rive_artboard_v1"===f)&&(k=>void 0===k?l("rive_artboard_v1","drawable_properties"):(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(118)),Ed:(null===f||"rive_audio_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(119)),Hd:(null===f||"rive_audio_v1"===f)&&(k=>b=>{0===a.g&&
v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(120)),Gd:(null===f||"rive_audio_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(121)),Id:(null===f||"rive_audio_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(122)),Fd:(null===f||"rive_audio_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,
b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(123)),md:(null===f||"rive_audio_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(124)),od:(null===f||"rive_audio_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(125)),qd:(null===f||"rive_audio_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=
m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(126)),nd:(null===f||"rive_audio_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(127)),pd:(null===f||"rive_audio_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(128)),Jd:(null===f||"rive_audio_v1"===f)&&(k=>()=>{0===a.g&&v();c.i&&c.l++;try{var b=k(a.g)}catch(g){throw b=g,a.h=
!0,b;}a.h&&p();null!==a.j&&n();return b})(r(129)),Kd:(null===f||"rive_audio_v1"===f)&&(k=>()=>{0===a.g&&v();c.i&&c.l++;try{var b=k(a.g)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n();return b})(r(130)),rd:(null===f||"rive_audio_v1"===f)&&(k=>()=>{0===a.g&&v();c.i&&c.l++;try{var b=k(a.g)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n();return b})(r(131)),vd:(null===f||"rive_audio_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(132)),
ud:(null===f||"rive_audio_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(133)),td:(null===f||"rive_audio_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(134)),wd:(null===f||"rive_audio_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(135)),Ad:(null===f||"rive_audio_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&
c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(136)),xd:(null===f||"rive_audio_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(137)),yd:(null===f||"rive_audio_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(138)),sd:(null===f||"rive_audio_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=
k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(139)),Bd:(null===f||"rive_audio_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(140)),Cd:(null===f||"rive_audio_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(141)),Dd:(null===f||"rive_audio_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=
h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(142)),zd:(null===f||"rive_audio_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(143)),Fh:(null===f||"rive_path_v1"===f)&&(k=>()=>{0===a.g&&v();c.i&&c.l++;try{var b=k(a.g)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n();return b})(r(144)),Ih:(null===f||"rive_path_v1"===f)&&(k=>(b,g,h,m,x,K)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x,K)}catch(S){throw b=S,a.h=!0,b;}a.h&&
p();null!==a.j&&n()})(r(145)),Hh:(null===f||"rive_path_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(146)),Dh:(null===f||"rive_path_v1"===f)&&(k=>(b,g,h,m,x,K,S,A)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x,K,S,A)}catch(w){throw b=w,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(147)),Jh:(null===f||"rive_path_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(148)),
Gh:(null===f||"rive_path_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(149)),Eh:(null===f||"rive_path_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(150)),ih:(null===f||"rive_measure_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(151)),
dh:(null===f||"rive_measure_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(152)),bh:(null===f||"rive_measure_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(153)),hh:(null===f||"rive_measure_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(154)),
gh:(null===f||"rive_measure_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(155)),jh:(null===f||"rive_measure_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(156)),lh:(null===f||"rive_measure_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(157)),eh:(null===
f||"rive_measure_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(158)),fh:(null===f||"rive_measure_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;let K;try{K=k(a.g,b,g,h,m,x)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n();return K})(r(159)),kh:(null===f||"rive_measure_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(160)),xh:(null===
f||"rive_paint_v1"===f)&&(k=>()=>{0===a.g&&v();c.i&&c.l++;try{var b=k(a.g)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n();return b})(r(161)),yh:(null===f||"rive_paint_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(162)),Bh:(null===f||"rive_paint_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(163)),uh:(null===f||"rive_paint_v1"===f)&&(k=>(b,g)=>{0===a.g&&
v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(164)),Ch:(null===f||"rive_paint_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(165)),wh:(null===f||"rive_paint_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(166)),th:(null===f||"rive_paint_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,
a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(167)),sh:(null===f||"rive_paint_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(168)),vh:(null===f||"rive_paint_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(169)),zh:(null===f||"rive_paint_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(170)),Ah:(null===
f||"rive_paint_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(171)),Td:(null===f||"rive_canvas_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(172)),Ud:(null===f||"rive_canvas_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(173)),Wd:(null===f||"rive_canvas_v1"===f)&&(k=>b=>
{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(174)),Rd:(null===f||"rive_canvas_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(175)),Vd:(null===f||"rive_canvas_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(176)),Sd:(null===f||"rive_canvas_v1"===f)&&(k=>b=>{0===
a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(177)),Pd:(null===f||"rive_canvas_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(178)),Qd:(null===f||"rive_canvas_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(179)),cg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;
try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(180)),$f:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(181)),ag:(null===f||"rive_gpu_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(182)),Yf:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=
x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(183)),Zf:(null===f||"rive_gpu_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(184)),bg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;let K;try{K=k(a.g,b,g,h,m,x)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n();return K})(r(185)),Bg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=
x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(186)),eg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(187)),mg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(188)),pg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m)}catch(x){throw b=x,a.h=!0,b;}a.h&&
p();null!==a.j&&n()})(r(189)),lg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(190)),jg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(191)),qg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x,K,S)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x,K,S)}catch(A){throw b=A,a.h=!0,b;}a.h&&p();null!==a.j&&
n()})(r(192)),ng:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(193)),og:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(194)),kg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(195)),fg:(null===f||"rive_gpu_v1"===
f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(196)),gg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x,K)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x,K)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(197)),hg:(null===f||"rive_gpu_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(198)),ig:(null===f||"rive_gpu_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;
try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(199)),dg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(200)),Tf:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;let K;try{K=k(a.g,b,g,h,m,x)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n();return K})(r(201)),Wf:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,
b,g,h,m)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(202)),Xf:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(203)),Uf:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;let K;try{K=k(a.g,b,g,h,m,x)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n();return K})(r(204)),Vf:(null===f||"rive_gpu_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=
g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(205)),Cg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(206)),Eg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(207)),Dg:(null===f||"rive_gpu_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&
n()})(r(208)),tg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(209)),ug:(null===f||"rive_gpu_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(210)),Fg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(211)),Gg:(null===
f||"rive_gpu_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(212)),Ag:(null===f||"rive_gpu_v1"===f)&&(k=>()=>{0===a.g&&v();c.i&&c.l++;try{var b=k(a.g)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n();return b})(r(213)),vg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;let K;try{K=k(a.g,b,g,h,m,x)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n();return K})(r(214)),wg:(null===f||"rive_gpu_v1"===f)&&
(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(215)),xg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(216)),yg:(null===f||"rive_gpu_v1"===f)&&(k=>void 0===k?l("rive_gpu_v1","shader_module_from_rstb"):(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();
null!==a.j&&n();return x})(r(217)),zg:(null===f||"rive_gpu_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(218)),Pf:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(219)),Qf:(null===f||"rive_gpu_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(220)),Nf:(null===
f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(221)),Of:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;let K;try{K=k(a.g,b,g,h,m,x)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n();return K})(r(222)),Mf:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x,K,S)=>{0===a.g&&v();c.i&&c.l++;let A;try{A=k(a.g,b,g,h,m,x,K,S)}catch(w){throw b=w,a.h=!0,b;}a.h&&p();null!==a.j&&
n();return A})(r(223)),Rf:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m,x,K,S)=>{0===a.g&&v();c.i&&c.l++;let A;try{A=k(a.g,b,g,h,m,x,K,S)}catch(w){throw b=w,a.h=!0,b;}a.h&&p();null!==a.j&&n();return A})(r(224)),Sf:(null===f||"rive_gpu_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(225)),rg:(null===f||"rive_gpu_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&
n();return x})(r(226)),sg:(null===f||"rive_gpu_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(227)),ah:(null===f||"rive_mat4_v1"===f)&&(k=>(b,g,h,m,x,K)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x,K)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(228)),$g:(null===f||"rive_mat4_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(229)),
Md:(null===f||"rive_buffer_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(230)),Od:(null===f||"rive_buffer_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(231)),Nd:(null===f||"rive_buffer_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(232)),mh:(null===f||"rive_mesh_instances_v1"===
f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(233)),oh:(null===f||"rive_mesh_instances_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(234)),ph:(null===f||"rive_mesh_instances_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(235)),nh:(null===f||"rive_mesh_instances_v1"===f)&&
(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(236)),Ld:(null===f||"rive_blob_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;let K;try{K=k(a.g,b,g,h,m,x)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n();return K})(r(237)),Jg:(null===f||"rive_image_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(238)),Mg:(null===f||"rive_image_v1"===f)&&(k=>b=>
{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(239)),Kg:(null===f||"rive_image_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(240)),Lg:(null===f||"rive_image_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(241)),Hg:(null===f||"rive_image_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;
try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(242)),Ig:(null===f||"rive_image_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(243)),Df:(null===f||"rive_font_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(244)),Bf:(null===f||"rive_font_v1"===f)&&(k=>void 0===k?l("rive_font_v1","decode"):(b,g)=>{0===a.g&&
v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(245)),Jf:(null===f||"rive_font_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(246)),If:(null===f||"rive_font_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(247)),Kf:(null===f||"rive_font_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=
h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(248)),Hf:(null===f||"rive_font_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(249)),zf:(null===f||"rive_font_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(250)),yf:(null===f||"rive_font_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m)}catch(x){throw b=x,a.h=!0,b;}a.h&&
p();null!==a.j&&n()})(r(251)),Af:(null===f||"rive_font_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(252)),Cf:(null===f||"rive_font_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(253)),Gf:(null===f||"rive_font_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==
a.j&&n();return h})(r(254)),Lf:(null===f||"rive_font_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;let K;try{K=k(a.g,b,g,h,m,x)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n();return K})(r(255)),Ff:(null===f||"rive_font_v1"===f)&&(k=>void 0===k?l("rive_font_v1","glyph_verbs"):(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(256)),Ef:(null===f||"rive_font_v1"===f)&&(k=>void 0===k?l("rive_font_v1","glyph_points"):
(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(257)),Xi:(null===f||"rive_text_v1"===f)&&(k=>void 0===k?l("rive_text_v1","new"):()=>{0===a.g&&v();c.i&&c.l++;try{var b=k(a.g)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n();return b})(r(258)),Yi:(null===f||"rive_text_v1"===f)&&(k=>void 0===k?l("rive_text_v1","release"):b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(259)),
Ni:(null===f||"rive_text_v1"===f)&&(k=>void 0===k?l("rive_text_v1","append"):(b,g,h,m,x,K,S,A,w)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x,K,S,A,w)}catch(t){throw b=t,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(260)),Qi:(null===f||"rive_text_v1"===f)&&(k=>void 0===k?l("rive_text_v1","clear"):b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(261)),Ui:(null===f||"rive_text_v1"===f)&&(k=>void 0===k?l("rive_text_v1","layout"):(b,g,h)=>{0===a.g&&v();c.i&&
c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(262)),Ri:(null===f||"rive_text_v1"===f)&&(k=>void 0===k?l("rive_text_v1","draw"):(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(263)),Oi:(null===f||"rive_text_v1"===f)&&(k=>void 0===k?l("rive_text_v1","bounds"):(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(264)),Vi:(null===f||"rive_text_v1"===f)&&
(k=>void 0===k?l("rive_text_v1","length"):b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(265)),Wi:(null===f||"rive_text_v1"===f)&&(k=>void 0===k?l("rive_text_v1","lines"):(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(266)),Zi:(null===f||"rive_text_v1"===f)&&(k=>void 0===k?l("rive_text_v1","runs"):(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,
g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(267)),Si:(null===f||"rive_text_v1"===f)&&(k=>void 0===k?l("rive_text_v1","glyphs"):(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(268)),Ti:(null===f||"rive_text_v1"===f)&&(k=>void 0===k?l("rive_text_v1","hit_test"):(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(269)),Pi:(null===
f||"rive_text_v1"===f)&&(k=>void 0===k?l("rive_text_v1","caret"):(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(270)),$i:(null===f||"rive_text_v1"===f)&&(k=>void 0===k?l("rive_text_v1","selection_rects"):(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;let K;try{K=k(a.g,b,g,h,m,x)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n();return K})(r(271)),di:(null===f||"rive_shader_v1"===f)&&(k=>(b,g,h,m,x,K,S)=>{0===a.g&&v();c.i&&
c.l++;let A;try{A=k(a.g,b,g,h,m,x,K,S)}catch(w){throw b=w,a.h=!0,b;}a.h&&p();null!==a.j&&n();return A})(r(272)),ei:(null===f||"rive_shader_v1"===f)&&(k=>(b,g,h,m,x,K)=>{0===a.g&&v();c.i&&c.l++;let S;try{S=k(a.g,b,g,h,m,x,K)}catch(A){throw b=A,a.h=!0,b;}a.h&&p();null!==a.j&&n();return S})(r(273)),fi:(null===f||"rive_shader_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(274)),Mi:(null===f||"rive_test_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&
v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(275)),bj:(null===f||"rive_transition_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(276)),dj:(null===f||"rive_transition_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(277)),cj:(null===f||"rive_transition_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&
c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(278)),Sh:(null===f||"rive_renderer_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(279)),Rh:(null===f||"rive_renderer_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(280)),Th:(null===f||"rive_renderer_v1"===f)&&(k=>(b,g,h,m,x,K,S)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x,
K,S)}catch(A){throw b=A,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(281)),Oh:(null===f||"rive_renderer_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(282)),Kh:(null===f||"rive_renderer_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(283)),Qh:(null===f||"rive_renderer_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g)}catch(h){throw b=h,a.h=!0,b;}a.h&&
p();null!==a.j&&n()})(r(284)),Ph:(null===f||"rive_renderer_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(285)),Lh:(null===f||"rive_renderer_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(286)),Mh:(null===f||"rive_renderer_v1"===f)&&(k=>(b,g,h,m,x,K,S,A)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x,K,S,A)}catch(w){throw b=w,a.h=!0,b;}a.h&&
p();null!==a.j&&n()})(r(287)),Nh:(null===f||"rive_renderer_v1"===f)&&(k=>(b,g,h,m,x,K,S)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x,K,S)}catch(A){throw b=A,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(288)),qh:(null===f||"rive_net_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(289)),rh:(null===f||"rive_net_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&
n()})(r(290)),wf:(null===f||"rive_file_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(291)),xf:(null===f||"rive_file_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(292)),pf:(null===f||"rive_file_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(293)),qf:(null===
f||"rive_file_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(294)),rf:(null===f||"rive_file_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(295)),vf:(null===f||"rive_file_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(296)),uf:(null===f||"rive_file_v1"===
f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(297)),sf:(null===f||"rive_file_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(298)),tf:(null===f||"rive_file_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(299)),Ug:(null===f||"rive_lanes_v1"===f)&&
(k=>(b,g,h,m,x,K)=>{0===a.g&&v();c.i&&c.l++;let S;try{S=k(a.g,b,g,h,m,x,K)}catch(A){throw b=A,a.h=!0,b;}a.h&&p();null!==a.j&&n();return S})(r(300)),Vg:(null===f||"rive_lanes_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(301)),Rg:(null===f||"rive_lanes_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(302)),Wg:(null===f||"rive_lanes_v1"===
f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(303)),Sg:(null===f||"rive_lanes_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(304)),Tg:(null===f||"rive_lanes_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(305)),Zg:(null===f||"rive_lanes_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;
try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(306)),Xg:(null===f||"rive_lanes_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(307)),Qg:(null===f||"rive_lanes_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(308)),Yg:(null===f||"rive_lanes_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,
h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(309)),Pg:(null===f||"rive_jobs_v1"===f)&&(k=>()=>{0===a.g&&v();c.i&&c.l++;try{var b=k(a.g)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n();return b})(r(310)),Ng:(null===f||"rive_jobs_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(311)),Og:(null===f||"rive_jobs_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=
x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(312)),pi:(null===f||"rive_shared_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(313)),ui:(null===f||"rive_shared_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(314)),ri:(null===f||"rive_shared_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=
!0,b;}a.h&&p();null!==a.j&&n();return h})(r(315)),vi:(null===f||"rive_shared_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(316)),ti:(null===f||"rive_shared_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(317)),wi:(null===f||"rive_shared_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,
b;}a.h&&p();null!==a.j&&n();return x})(r(318)),si:(null===f||"rive_shared_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(319)),ii:(null===f||"rive_shared_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(320)),ki:(null===f||"rive_shared_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=
!0,b;}a.h&&p();null!==a.j&&n();return m})(r(321)),gi:(null===f||"rive_shared_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(322)),hi:(null===f||"rive_shared_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(323)),zi:(null===f||"rive_shared_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=
h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(324)),Ei:(null===f||"rive_shared_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;let K;try{K=k(a.g,b,g,h,m,x)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n();return K})(r(325)),Bi:(null===f||"rive_shared_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(326)),Ai:(null===f||"rive_shared_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,
b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(327)),Di:(null===f||"rive_shared_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(328)),Ci:(null===f||"rive_shared_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(329)),Ii:(null===f||"rive_shared_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=
h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(330)),Ji:(null===f||"rive_shared_v1"===f)&&(k=>(b,g,h,m,x)=>{0===a.g&&v();c.i&&c.l++;let K;try{K=k(a.g,b,g,h,m,x)}catch(S){throw b=S,a.h=!0,b;}a.h&&p();null!==a.j&&n();return K})(r(331)),Ki:(null===f||"rive_shared_v1"===f)&&(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;let m;try{m=k(a.g,b,g,h)}catch(x){throw b=x,a.h=!0,b;}a.h&&p();null!==a.j&&n();return m})(r(332)),Li:(null===f||"rive_shared_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=
h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(333)),oi:(null===f||"rive_shared_v1"===f)&&(k=>()=>{0===a.g&&v();c.i&&c.l++;try{k(a.g)}catch(g){var b=g;a.h=!0;throw b;}a.h&&p();null!==a.j&&n()})(r(334)),Fi:(null===f||"rive_shared_v1"===f)&&(k=>()=>{0===a.g&&v();c.i&&c.l++;try{var b=k(a.g)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n();return b})(r(335)),Gi:(null===f||"rive_shared_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(336)),
Hi:(null===f||"rive_shared_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(337)),li:(null===f||"rive_shared_v1"===f)&&(k=>(b,g)=>{0===a.g&&v();c.i&&c.l++;let h;try{h=k(a.g,b,g)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n();return h})(r(338)),ni:(null===f||"rive_shared_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(339)),mi:(null===
f||"rive_shared_v1"===f)&&(k=>(b,g,h,m)=>{0===a.g&&v();c.i&&c.l++;let x;try{x=k(a.g,b,g,h,m)}catch(K){throw b=K,a.h=!0,b;}a.h&&p();null!==a.j&&n();return x})(r(340)),yi:(null===f||"rive_shared_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;let g;try{g=k(a.g,b)}catch(h){throw b=h,a.h=!0,b;}a.h&&p();null!==a.j&&n();return g})(r(341)),xi:(null===f||"rive_shared_v1"===f)&&(k=>b=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b)}catch(g){throw b=g,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(342)),Xd:(null===f||"env"===f)&&
(k=>(b,g,h)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h)}catch(m){throw b=m,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(343)),aj:(null===f||"env"===f)&&(k=>(b,g,h,m,x,K,S,A)=>{0===a.g&&v();c.i&&c.l++;try{k(a.g,b,g,h,m,x,K,S,A)}catch(w){throw b=w,a.h=!0,b;}a.h&&p();null!==a.j&&n()})(r(344))}}function l(r,a){return()=>{throw Error("failed to call unlinked import function "+r+"."+a);}}function q(r,a,f){if(a+f>r.byteLength)throw Error("out of bounds memory access");}function z(r,a){a>>>=0;if(4>a)return 0;q(r,
a,0);const f=(new DataView(r)).getUint32(a-4,!0);q(r,a,f);return f}function C(r,a,f){a>>>=0;f>>>=0;q(r,a,f);if("undefined"!==typeof TextDecoder)return(new TextDecoder("utf-16le",{ignoreBOM:!0})).decode(new Uint8Array(r,a,f));r=0===a%2?new Uint16Array(r,a,f>>1):new Uint16Array(r.slice(a,a+f-f%2));a="";for(f=0;f<r.length;f+=4096)a+=String.fromCharCode.apply(null,r.subarray(f,f+4096));return a}function D(r,a){let f=Fc.get(a);if(void 0===f){for(let c=0;32>c&&void 0===f;c++){const n=a+16+4*c>>>2;0===Atomics.compareExchange(r,
n,0,1)&&(f={fa:n,Ya:2+c})}f??={fa:-1,Ya:34+Atomics.add(r,a+144>>>2,1)};Fc.set(a,f)}return f}function F(r,a,f,c,n=null,p=()=>{}){a>>>=0;const v=f%4294967296,k=Math.floor(f/4294967296);let b=null,g=null,h=null,m=null,x=null,K=null;const S=()=>{const G=r();G!==b&&(b=G,g=new Uint8Array(b),h=new Int32Array(b),m=new Uint32Array(b))};S();const A=D(h,a);null!==n&&Atomics.store(n,2,A.Ya);const w=(G,W)=>{const X=c().buffer;X!==x&&(x=X,K=new Uint8Array(X));return G+W<=K.length?K:null},t=(G,W,X,Y,ca)=>{for(let da=
0;da<ca;da++)G[W+da]=X[Y+da]},y=G=>{for(null!==n&&Atomics.store(n,3,G);0!==Atomics.compareExchange(h,G>>>2,0,A.Ya););},u=G=>{Atomics.store(h,G>>>2,0);null!==n&&Atomics.store(n,3,0)};let E=0;const M=(G,W)=>{S();G>>>=0;if(0===(G&2147483648))return 0;var X=(G&2147483647)>>>12,Y=Atomics.load(m,a+148+4*(X>>>10)>>>2);if(0===Y)return 0;X=Y+24*(X&1023);Y=X>>>2;if(0<=A.fa){if(Atomics.store(m,A.fa,X),Y=Atomics.load(m,Y),0===(Y&4096)||0!==((Y^G)&4095))return Atomics.store(m,A.fa,1),0}else for(;;){const ca=Atomics.load(m,
Y);if(0===(ca&4096)||0!==((ca^G)&4095))return 0;if(Atomics.compareExchange(m,Y,ca,ca+8192)===ca)break}E=X;G=Atomics.load(m,X+4>>>2);return m[G>>>2]!==W||m[X+16>>>2]!==v||m[X+20>>>2]!==k?(P(),0):G},P=()=>{0<=A.fa?Atomics.store(m,A.fa,1):Atomics.sub(m,E+0>>>2,8192)},pa=G=>{G=M(G,3);if(0!==G){4294967295===Atomics.add(m,G+24>>>2,1)&&Atomics.add(m,G+28>>>2,1);y(G+4);try{const W=m[G+16>>>2],X=m[G+32>>>2]>>>2;for(let Y=0;Y<W;Y++){const ca=m[X+Y]+0>>>2;Atomics.add(h,ca,1);Atomics.notify(h,ca)}}finally{u(G+
4),P()}}},Ba=(G,W,X,Y,ca)=>{const da=Math.min(ca,m[G+8>>>2]-W);t(g,G+32+W,X,Y,da);t(g,G+32,X,Y+da,ca-da)},Ka=(G,W,X,Y,ca)=>{var da=m[G+8>>>2];W%=da;da=Math.min(ca,da-W);t(X,Y,g,G+32+W,da);t(X,Y+da,g,G+32,ca-da)},mb=new Uint8Array(4),ub=new Uint32Array(mb.buffer),Sa=()=>{p("a processor cannot pass shared objects through rings or snapshots, as the audio thread may not hold or give them back; pass them in Audio.start's argument");return 0},ha=(G,W,X,Y)=>{G=M(G,1);if(0===G)return 0;let ca=0,da=0;y(G+
4);try{const Ea=m[G+20>>>2];if(0===Ea)return 0;const Ca=m[G+16>>>2];Ka(G,Ca,mb,0,4);da=ub[0];if(0!==(da&2147483648))return Sa();if(null===W){if(da<=Y)return 0}else{if(0===X||da>Y)return da+1;Ka(G,Ca+4,W,X,da)}m[G+16>>>2]=(Ca+4+da)%m[G+8>>>2];m[G+20>>>2]=Ea-4-da;ca=m[G+28>>>2]}finally{u(G+4),P()}pa(ca);return da+1},za=(G,W,X)=>{G=M(G,0);if(0===G)return-1;try{W>>>=0;var Y=0!==(W&3)||W+4>m[G+8>>>2]?-1:G+32+W>>>2;return 0>Y?-1:X(Y)>>>0}finally{P()}};return{region_create:()=>0,region_size:G=>{G=M(G,0);
if(0===G)return 0;G=m[G+8>>>2];P();return G},region_lock:()=>0,region_unlock:()=>{},region_read:()=>0,region_write:()=>0,region_poisoned:G=>{G=M(G,0);if(0===G)return 0;G=0!==m[G+16>>>2]?1:0;P();return G},atomic_load:(G,W)=>za(G,W,X=>Atomics.load(h,X)),atomic_store:(G,W,X)=>za(G,W,Y=>{Atomics.store(h,Y,X|0);return 0}),atomic_add:(G,W,X)=>za(G,W,Y=>Atomics.add(h,Y,X|0)),atomic_cas:(G,W,X,Y)=>za(G,W,ca=>Atomics.compareExchange(h,ca,X|0,Y|0)),ring_create:()=>0,ring_write:(G,W,X,Y,ca)=>{W>>>=0;X>>>=0;
Y=w(W,X);G=null!==Y?M(G,1):0;if(0===G)return 0;if(0!==ca)return P(),Sa();ca=0;y(G+4);try{const da=m[G+8>>>2];if(4+X>da)return 2;const Ea=m[G+20>>>2];if(Ea+4+X>da)return 0;const Ca=m[G+16>>>2];ub[0]=X;Ba(G,(Ca+Ea)%da,mb,0,4);Ba(G,(Ca+Ea+4)%da,Y,W,X);m[G+20>>>2]=Ea+4+X;ca=m[G+24>>>2]}finally{u(G+4),P()}pa(ca);return 1},ring_read:(G,W,X)=>{W>>>=0;X>>>=0;const Y=w(W,X);return null!==Y?ha(G,Y,W,X):0},ring_drop:(G,W)=>ha(G,null,0,W>>>0),ring_used:G=>{G=M(G,1);if(0===G)return 0;y(G+4);const W=m[G+20>>>2];
u(G+4);P();return W},ring_signal:(G,W)=>{G=M(G,1);if(0===G)return 0;W=m[G+(0!==W?28:24)>>>2];P();return W},snapshot_create:()=>0,snapshot_publish:(G,W,X,Y,ca)=>{W>>>=0;X>>>=0;Y=w(W,X);G=null!==Y?M(G,2):0;if(0===G)return 0;try{const Ea=m[G+8>>>2];if(0!==ca)return Sa();if(X>Ea)return 0;y(G+4);try{ca=G+16>>>2;var da=Atomics.load(m,ca);const Ca=G+40>>>2;if(0!==((0!==da?Atomics.load(m,Ca+da-1):0)&2147483648))return Sa();da%=2;const Ta=(G+32>>>2)+da,Ua=Atomics.load(m,Ta)|1;Atomics.store(m,Ta,Ua);Atomics.load(m,
Ta);t(g,G+48+da*Ea,Y,W,X);Atomics.store(m,Ca+da,X);Atomics.store(m,Ta,Ua+1);Atomics.store(m,ca,da+1);4294967295===Atomics.add(m,G+24>>>2,1)&&Atomics.add(m,G+28>>>2,1)}finally{u(G+4)}return 1}finally{P()}},snapshot_read:(G,W,X)=>{W>>>=0;X>>>=0;const Y=w(W,X);G=null!==Y?M(G,2):0;if(0===G)return 0;try{for(;;){const da=Atomics.load(m,G+16>>>2);if(0===da)return 0;var ca=da-1;const Ea=(G+32>>>2)+ca,Ca=Atomics.load(m,Ea);if(0!==(Ca&1))continue;const Ta=Atomics.load(m,(G+40>>>2)+ca),Ua=m[G+8>>>2];ca=G+48+
ca*Ua;const Kb=0!==(Ta&2147483648),fb=Math.min(Ta,Ua);!Kb&&0!==W&&fb<=X&&t(Y,W,g,ca,fb);if(Atomics.compareExchange(m,Ea,Ca,Ca)===Ca)return Kb?Sa():fb+1}}finally{P()}},snapshot_seq:G=>{G=M(G,2);if(0===G)return 0;G=4294967296*Atomics.load(m,G+28>>>2)+Atomics.load(m,G+24>>>2);P();return G},signal_create:()=>0,signal_notify:G=>pa(G),signal_seq:G=>{G=M(G,3);if(0===G)return 0;G=4294967296*Atomics.load(m,G+28>>>2)+Atomics.load(m,G+24>>>2);P();return G},blob_create:()=>0,blob_size:G=>{G=M(G,4);if(0===G)return 0;
G=m[G+8>>>2];P();return G},blob_read:(G,W,X,Y)=>{W>>>=0;X>>>=0;Y>>>=0;const ca=w(X,Y);G=null!==ca?M(G,4):0;if(0===G)return 0;const da=m[G+8>>>2];Y=W<da?Math.min(Y,da-W):0;t(ca,X,g,G+16+W,Y);P();return Y},retain:()=>0,release:()=>{}}}function J(r,a,f){const c=Atomics.load(f,2);2>c||(r=new Int32Array(r()),f=Atomics.load(f,3),0!==f&&Atomics.compareExchange(r,f>>>2,c,0),34>c&&Atomics.store(r,((a>>>0)+16>>>2)+c-2,0))}function N(r){return String(r?.message??r)}function R(r,a,f=new Map){const c=v=>{const k=
r().buffer;return C(k,v,z(k,v))},n={};for(var p of wa)n[p]=v=>a(c(v));p=v=>k=>{k=c(k);const b=f.get(k);void 0===b?a(`Timer '${k}' does not exist`):(v&&f.delete(k),a(`${k}: ${(gb()-b).toFixed(3)}ms`))};n["console.time"]=v=>f.set(c(v),gb());n["console.timeLog"]=p(!1);n["console.timeEnd"]=p(!0);return n}function T(r){let a=null,f=null;const c=p=>f??N(p),n={env:R(()=>a,r.log,r.Ga),rive_shared_v1:r.Wa(()=>a),rive_lane_v1:{error:(p,v)=>{f=C(a.buffer,p,v);r.pc?.(f)},fuel_check:r.Oa??Ld}};void 0!==r.Ua&&
(n[r.Ua]=r.mb(()=>a));try{const p=(new WebAssembly.Instance(r.module,n)).exports;a=p.memory;return{exports:p,memory:a,Na:c}}catch(p){return{error:f??N(p)}}}function V(r,a,f=!1){try{const c=r.exports;c[f?"__riveLaneReset":"__riveLiftedStart"]?.();const n=a.input,p=c.__rive_lane_alloc(n.length)>>>0;(new Uint8Array(r.memory.buffer,p,n.length)).set(n);const v=c[a.prefix+a.Ma](p,n.length,...(a.Fb??[]));a.ca&&c.__rive_lane_free(p);return{result:v}}catch(c){return{error:r.Na(c)}}}function na(r){const a=
T(r);r=void 0===a.error?V(a,r):a;return void 0===r.error?{...a,result:r.result}:r}function qa(r,a,f,c,n,p){let v=null;const k=S=>{v??=S};var b=gb()+1E3,g="processor init overran its budget";const h=na({module:r,Wa:S=>n(S,k),log:p,Oa:()=>{if(gb()>b)throw g;},prefix:vb.processor,Ma:a,input:f,Fb:[c.sampleRate,c.nc,c.channels],ca:!0});if(void 0!==h.error||null!==v)return{error:h.error??v};b=Infinity;g="processor overran its block budget";const m=h.exports,x=h.memory;let K=null;return{ja:{xc(S,A,w,t=0){0<
t&&(b=gb()+t);try{const y=m.__rive_processor_process(S,A)>>>0;if(null!==v)return v;const u=S*c.channels;if(null===K||K.buffer!==x.buffer||K.byteOffset!==y||K.length!==u)K=new Float32Array(x.buffer,y,u);w(K);m.__riveFrameMinor?.();return null}catch(y){return h.Na(y)}finally{b=Infinity}}}}}function U(r){r=[0,...r,11];return new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,r.length+2,1,r.length,...r])}function ba(r){let a=0,f=8;const c=()=>{const [g,h]=fa(r,f);f=h;return g},n=()=>{const g=
r[f++];123===g&&(a=Math.max(a,1));return 99!==g&&100!==g},p=()=>{var g=r[f++];if(253===g)g=c(),a=Math.max(a,256<=g&&275>=g?2:1),11>=g||92===g||93===g?(c()&64&&c(),c()):12===g||13===g?f+=16:21<=g&&34>=g?f+=1:84<=g&&91>=g&&(c()&64&&c(),c(),f+=1);else if(252===g){g=c();if(g>=Gc.length)return!1;for(let h=0;h<Gc[g];h++)c()}else if(254===g)3===c()?f+=1:(c()&64&&c(),c());else if(40<=g&&62>=g)c()&64&&c(),c();else if(2<=g&&4>=g)123===r[f]&&(a=Math.max(a,1)),c();else if(14===g)for(g=c();0<=g&&f<r.length;g--)c();
else if(28===g)for(g=c();0<g&&f<r.length;g--){if(!n())return!1}else if(17===g||19===g)c(),c();else if(67===g||68===g)f+=67===g?4:8;else if(32<=g&&38>=g||Md.includes(g))c();else if(!(1>=g||5===g||11===g||15===g||26===g||27===g||209===g||69<=g&&196>=g))return!1;return!0};for(;f<r.length;){var v=r[f];const [g,h]=fa(r,f+1);f=h;if(1===v)for(v=c();0<v&&f<r.length;v--){if(96!==r[f++])return-1;for(var k=0;2>k;k++)for(var b=c();0<b&&f<r.length;b--)if(!n())return-1}else if(10===v)for(v=c();0<v&&f<r.length;v--){k=
Math.min(c()+f,r.length);for(b=c();0<b&&f<k;b--)if(c(),!n())return-1;for(;f<k;)if(!p())return-1}f=h+g}return a}function fa(r,a){let f=0,c=0,n;do n=r[a++],f|=(n&127)<<c,c+=7;while(n&128);return[f>>>0,a]}function ea(r){const a=[];do{const f=r&127;r>>>=7;a.push(r?f|128:f)}while(r);return a}function ka(r){const a=[];for(let f=8;f<r.length;){const [c,n]=fa(r,f+1);a.push({id:r[f],at:f,body:n,end:n+c});f=n+c}return a}function va(r){const a=[];for(const f of ka(r)){if(0!==f.id)continue;const [c,n]=fa(r,f.body);
Nd.some(p=>p.length===c&&p.every((v,k)=>r[n+k]===v))&&a.push(r.subarray(n+c,f.end))}return a}function ra(r){var a=ka(r);const f=a.find(v=>8===v.id);var c=a.filter(v=>v!==f);if(void 0===f||!c.some(v=>7===v.id))return r;const n=fa(r,f.body)[0];a=[r.subarray(0,8)];for(var p of c){c=r.subarray(p.body,p.end);if(7===p.id){const [v,k]=fa(r,p.body);c=Array.from("__riveLiftedStart",b=>b.charCodeAt(0));c=Uint8Array.from([...ea(v+1),...r.subarray(k,p.end),...ea(c.length),...c,0,...ea(n)])}a.push(Uint8Array.from([p.id,
...ea(c.length)]),c)}r=new Uint8Array(a.reduce((v,k)=>v+k.length,0));p=0;for(const v of a)r.set(v,p),p+=v.length;return r}function Va(r,a,f,c){switch(c){case 0:return r();case 1:return r(a[f]);case 2:return r(a[f],a[f+1]);case 3:return r(a[f],a[f+1],a[f+2]);case 4:return r(a[f],a[f+1],a[f+2],a[f+3]);case 5:return r(a[f],a[f+1],a[f+2],a[f+3],a[f+4]);case 6:return r(a[f],a[f+1],a[f+2],a[f+3],a[f+4],a[f+5]);case 7:return r(a[f],a[f+1],a[f+2],a[f+3],a[f+4],a[f+5],a[f+6]);case 8:return r(a[f],a[f+1],a[f+
2],a[f+3],a[f+4],a[f+5],a[f+6],a[f+7]);default:return r(...a.subarray(f,f+c))}}const wa=["console.log","console.debug","console.info","console.warn","console.error"],ua=[["rive_lanes_v1","wait_within",[],"blocks on a signal, which only the main lane may; a worker awaits Signal.next or Port.receive instead"],["rive_shared_v1","region_lock",["job","worker"],"locks a shared region, which the audio thread may not wait on; share through atomics, rings and snapshots instead"],["rive_shared_v1","read_done",
[],null],["rive_shared_v1",null,["job","worker","processor"],null],["rive_lane_v1",null,["job","worker","processor"],null],["rive_job_v1",null,["job"],null],["rive_worker_v1",null,["worker"],null],["env","console.log",["job","worker","processor"],null],["env","console.debug",["job","worker","processor"],null],["env","console.info",["job","worker","processor"],null],["env","console.warn",["job","worker","processor"],null],["env","console.error",["job","worker","processor"],null],["env","console.time",
["job","worker"],null],["env","console.timeLog",["job","worker"],null],["env","console.timeEnd",["job","worker"],null]],nb=[["rive.jobs","job"],["rive.workers","worker"],["rive.audio","processor"]],vb={job:"__rive_job_",worker:"__rive_worker_",processor:"__rive_processor_"},Hc={starting:0,running:1,done:2,failed:3,stopped:4},Fc=new Map,gb=void 0!==globalThis.performance?()=>globalThis.performance.now():Date.now,Ld=()=>{},ac=[253,12,...Array(16).fill(0)],Od=U([...ac]),Pd=U([...ac,...ac,253,128,2]),
Gc=[0,0,0,0,0,0,0,0,2,1,2,1,2,1,2,1,1,1],Md=[12,13,16,18,63,64,65,66,208,210],Nd=nb.map(([r])=>Array.from(r,a=>a.charCodeAt(0)));(function(r){function a(B,H=null){return{Lb:e(ha.fc,B,H),W:ha.W,la:ha.la,Ea:ha.Ea,ka:ha.ka,Ta:ha.Ta,ca:ha.ca,wa:G}}function f(B){Y??={ub:W(Od),sb:W(Pd)};B=[B,...va(B)];if(Y.ub&&Y.sb||B.every(H=>W(H)))return null;B=Math.max(...B.map(ba));return!Y.ub&&0<B?"this browser lacks WebAssembly SIMD, so this file's scripts are off; bake with wasmSimd: off to support it":Y.sb||2!==
B?null:"this browser lacks WebAssembly relaxed SIMD, so this file's scripts are off; bake with wasmSimd: on to support it"}function c(B,H){const O=d(a(B.I),()=>{if(null===B.memory)throw Error("script passed memory to the host while its module was still starting");return B.memory});for(const Q of WebAssembly.Module.imports(H))if("function"===Q.kind){let aa,ia,ma,ja;(ma=(aa=O)[ia=Q.module]??(aa[ia]={}))[ja=Q.name]??(ma[ja]=l(Q.module,Q.name))}return O}function n(B,H){const O=ha.la();for(const {name:Q}of WebAssembly.Module.exports(H)){if(!Q.startsWith("__rive"))continue;
H=3*Q.length+1;const aa=ha.Ea(H);ha.yb(Q,aa,H);ha.exports._rive_web_vm_module_export(B.I.g,aa)}ha.ka(O);B=ha.exports._rive_web_vm_start_refusal(B.I.g);if(0!==B)throw Error(ha.oa(B));}function p(B,H){B.memory=H.exports.memory;B.U=null;B.Kb=Object.keys(H.exports).filter(oa=>oa.startsWith("__riveCall")).map(oa=>H.exports[oa]).filter(oa=>{if(!(oa instanceof WebAssembly.Global))return!1;try{return oa.value=oa.value,!0}catch{return!1}});B.Jb=[];const O=ha.exports._rive_web_vm_start_fuel(B.I.g),Q=H.exports.__riveFuelArm,
aa=H.exports.__riveFuelEnd,ia=0<O&&void 0!==Q&&void 0!==aa,ma=ha.exports._rive_web_vm_booting;ma(B.I.g);const ja=ha.la();B.instance=H;try{ia&&Q(O),H.exports.__riveLiftedStart?.(),ia&&aa()}catch(oa){throw B.instance=null,ha.ka(ja),B.I.j=null,oa;}finally{ma(0)}}async function v(B){try{const Q=await WebAssembly.compile(ra(B.U));if(0!==B.I.g){n(B,Q);var H=m(Q),O=await WebAssembly.instantiate(Q,c(B,Q));await H;0!==B.I.g&&p(B,O)}}catch(Q){B.error=N(Q)}}function k(B,H){if(B.length!==H.length)return!1;for(let O=
0;O<B.length;O++)if(B[O]!==H[O])return!1;return!0}function b(B,H,O){B={U:B,module:H,error:O,ia:new Set,Qa:null};ca.push(B);8<ca.length&&ca.shift();return B}function g(B,H){if(!Ea(B)){b(B,H,null);for(const O of da())O.postMessage({riveLane:{bytes:B,module:H}})}}function h(B,H){for(const aa of WebAssembly.Module.imports(B)){a:{B=H;var O=aa.module,Q=aa.name;for(const [ia,ma,ja,oa]of ua)if(O===ia&&(null===ma||Q===ma)){B=ja.includes(B)?null:oa??"";break a}B=""}if(null!==B)throw Error("lane module imports "+
aa.module+"."+aa.name+", which it cannot reach");}}function m(B,H=!1){const O=[];for(const [Q,aa]of nb)for(const ia of WebAssembly.Module.customSections(B,Q)){const ma=ra(new Uint8Array(ia));if(Ea(ma))continue;const ja=oa=>{h(oa,aa);g(ma,oa)};if(H)try{ja(new WebAssembly.Module(ma))}catch(oa){}else O.push(WebAssembly.compile(ma).then(ja).catch(()=>{}))}return Promise.all(O)}function x(B,H,O){let Q=ca.find(aa=>aa.ia.has(B));if(void 0===Q){const aa=H();Q=ca.find(ia=>k(ia.U,aa));if(void 0===Q){Q=b(aa,
null,null);try{const ia=new WebAssembly.Module(aa);h(ia,O);Q.module=ia}catch(ia){Q.error=N(ia)}}Q.ia.add(B);8<Q.ia.size&&Q.ia.delete(Q.ia.values().next().value)}return Q}function K(B=!1,H=0){return(O,Q)=>B?F(()=>ha.W().buffer,ha.exports._rive_shared_table(),H,O,null,Q):d(a({g:1,j:null,h:!1,wa:G},"rive_shared_v1"),O,"rive_shared_v1").rive_shared_v1}function S(B){B=ha.mc(B);if(null!==B)throw B;}function A(B){const H=B.Qa;B.Qa=null;if(null!==H)return H.Ga.clear(),H;const O={ja:0,eb:null,Ga:new Map,reset:!1};
return Object.assign(O,T({module:B.module,Ua:"rive_job_v1",mb:()=>({cancelled:()=>O.eb()}),Wa:K(),log:Q=>ha.Sa(O.ja,Q),Ga:O.Ga,Oa:()=>S(O.ja)}))}function w(){let B=[],H=null;return{Y(O){null!==H?H(O):B.push(O)},open(O){H=O;for(const Q of B)H(Q);B=[]},Wb(O){for(const Q of B)Sa({id:Q.id,kind:"failed",text:O});B=[]}}}function t(B){return{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{memory:ha.memory(),table:ha.exports._rive_shared_table(),counter:B.buffer}}}function y(B){for(const H of[...Aa.X.keys()])Sa({id:H,
kind:"failed",text:B})}function u(B,H,O,Q,aa,ia=aa){let ma=!1,ja=-1,oa=0;const Ia=setInterval(()=>{if("closed"===B.state)clearInterval(Ia),ia("script audio context closed");else{var Fa=Atomics.load(H,0),bc=(0<Aa.X.size||0<oa)&&"running"===B.state;oa=Fa===ja&&bc?oa+1:0;ja=Fa;Fa=ma?0!==Atomics.load(H,1)?30:Q:O;oa>=Fa&&(clearInterval(Ia),aa(ma?"processor stalled the audio thread":"script audio worklet never answered"))}},50);return{ready(){ma=!0;oa=0},stop:()=>clearInterval(Ia)}}function E(B,H,O=!0){B.qb.Wb(H);
Aa.output===B&&(Aa.output=null);O&&void 0===Ga.audioContext&&B.context.close?.()}function M(B){let H=cc.get(B);void 0===H&&(H={$a:new Int32Array(new SharedArrayBuffer(16)),Xa:!1},cc.set(B,H),B.addEventListener("statechange",()=>{"closed"!==B.state||H.Xa||Ic(H.$a)}));return H}function P(){const B=new AudioContext,H=["pointerdown","pointerup","keydown","touchend"],O=()=>B.resume(),Q=setTimeout(()=>console.warn("script audio waits for a click, tap or key press on the page"),1E3),aa=()=>{if("running"===
B.state||"closed"===B.state){clearTimeout(Q);B.removeEventListener("statechange",aa);for(const ia of H)globalThis.removeEventListener(ia,O,{capture:!0})}};for(const ia of H)globalThis.addEventListener(ia,O,{capture:!0});B.addEventListener("statechange",aa);aa();return B}function pa(){const B=Ga.audioContext??P(),H=w(),O={context:B,Y:H.Y,ea:new Set,qb:H},Q=M(B);let aa=null;const ia=ja=>{Aa.output===O&&(ma.stop(),y(ja),E(O,ja,!1))},ma=u(B,Q.$a,Infinity,20,ja=>{Q.Xa=!0;aa.port.onmessage=null;aa.port.postMessage({kind:"end"});
aa.disconnect();y(ja);E(O,ja,!1)},ia);B.addEventListener("statechange",()=>{"closed"===B.state&&ia("script audio context closed")});B.audioWorklet.addModule(Ga.audioWorkletUrl).then(()=>{aa=new AudioWorkletNode(B,"rive-processors",t(Q.$a));aa.port.onmessage=ja=>Sa(ja.data);aa.connect(B.destination);ma.ready();H.open(ja=>aa.port.postMessage(ja))}).catch(ja=>{ma.stop();E(O,dc(ja))});return O}function Ba(){const B=Ga.audioWorkletUrl;let H=Ga.audioContext;void 0===H&&(globalThis.nrdp.audio.output.open(),
H=new AudioContext);H.forceStart?.();const O=w(),Q={context:H,Y:O.Y,ea:new Set,qb:O},aa=new Int32Array(new SharedArrayBuffer(16));let ia=null,ma=!1,ja=!1;const oa=Ja=>{if(!ja){ja=!0;Ia.stop();ia?.terminate();if(ma){for(const ob=gb()+200;gb()<ob;);Ic(aa);y(Ja)}E(Q,Ja)}},Ia=u(H,aa,40,2,oa),Fa=Ja=>(...ob)=>{try{Ja(...ob)}catch(Lb){oa(dc(Lb))}},bc=Fa(()=>{(new AudioWorkletNode(H,"rive-processors",t(aa))).connect(H.destination);ma=!0;Ia.ready();O.open(Ja=>ia.send(Ja))});fetch(B).then(Ja=>{if(!Ja.ok)throw Error(B+
" answered HTTP "+Ja.status);return Ja.text()}).then(Ja=>{if(!ja){var ob=H.audioWorklet;ob.active=!0;ob.init(Fa(()=>{ja||(ia=globalThis.nrdp.thread.start({url:B,source:Ja,audio:H}),ia.addEventListener("raw-message",Lb=>"ready"===Lb.kind?bc():Sa(Lb)))}))}}).catch(Ja=>oa(dc(Ja)));return Q}function Ka(){let B;(B=Aa).output??(B.output=void 0!==globalThis.nrdp?.audio?.output?Ba():pa());return Aa.output}function mb(B){const H=new Set([...Aa.X.values()].map(O=>O.kb));for(const O of B.ea){if(8>=B.ea.size)break;
H.has(O)||(B.ea.delete(O),B.Y({kind:"forget",moduleId:O}))}}function ub(B,H,O){const Q=H.Nb;B.ea.add(H.kb);B.Y({...H.start,bytes:O?Q.U:null})}function Sa(B){const H=Aa.X.get(B.id);void 0!==H&&("resend"===B.kind?null!==Aa.output&&ub(Aa.output,H,!0):ha.uc(H.qc,Qd[B.kind],B.text??""))}let ha=null;const za=new Map,G={i:!1,l:0,ua:0,sa:0,ta:0,va:0},W=r.riveScriptingValidate??(B=>WebAssembly.validate(B)),X=!0===r.riveScriptingLaneTwin;let Y=null;const ca=[];let da=()=>[];const Ea=B=>ca.some(H=>k(H.U,B)),
Ca=B=>{B=B?.riveLane;void 0!==B&&g(B.bytes,B.module)},Ta=globalThis.process?.nj?.("worker_threads");!1===Ta?.oj?Ta.rj.i("message",Ca):void 0!==globalThis.WorkerGlobalScope&&globalThis.addEventListener("message",B=>Ca(B.data));const Ua=new Map;let Kb=1;const fb=new Map;let Rd=1;const Aa={output:null,X:new Map,next:1},Ic=B=>J(()=>ha.memory().buffer,ha.exports._rive_shared_table(),B),dc=B=>"script audio has no worklet: "+N(B),cc=new WeakMap,Qd={running:Hc.running,failed:Hc.failed,log:4294967295},Ga=
{Hb(B){ha??=B},lj(B){da=B},register(B,H){H=H.slice();za.set(B,{I:{g:B,j:null,h:!1,wa:G},U:H,instance:null,memory:null,Z:null,error:f(H),names:new Map})},release(B){const H=za.get(B);H&&(H.I.g=0,za.delete(B))},tc(){const B=[];for(const H of za.values())if(null===H.instance&&null===H.error){let O;(O=H).Z??(O.Z=v(H));B.push(H.Z)}return Promise.all(B)},start(B){B=za.get(B);if(!B)return"script module was never registered";if(null===B.instance&&null===B.error){if(null!==B.Z)return"script module is still being prepared";
try{const H=new WebAssembly.Module(ra(B.U));n(B,H);m(H,!0);p(B,new WebAssembly.Instance(H,c(B,H)))}catch(H){B.error=N(H)}}return B.error},Z(B){B=za.get(B);return null===B?.instance&&null===B.error&&null!==B.Z?1:0},ec(B,H){return"function"===typeof za.get(B)?.instance?.exports[ha.oa(H)]?1:0},call(B,H,O,Q,aa,ia,ma){B=za.get(B);if(!B||null===B.instance)return 1;let ja=B.names.get(H);void 0===ja&&(ja=B.instance.exports[ha.oa(H)]??null,B.names.set(H,ja));if("function"!==typeof ja)return 1;H=B.Kb;const oa=
B.Jb,Ia=oa.length;for(let Fa=0;Fa<H.length;Fa++)oa.push(H[Fa].value);try{const Fa=Va(ja,ha.ib(),Q>>3,O);ha.ib()[aa>>3]="number"===typeof Fa?Fa:0;return 0}catch(Fa){return B.I.j=null,ha.yb(N(Fa),ia,ma),B.I.h?3:2}finally{for(O=0;O<H.length;O++)H[O].value=oa[Ia+O];oa.length=Ia}},vc(B,H){if(B=za.get(B))B.I.j=ha.oa(H)},read(B,H,O,Q){B=za.get(B)?.memory;if(!B||H+Q>B.buffer.byteLength)return 0;ha.W().set(new Uint8Array(B.buffer,H,Q),O);G.i&&(G.ta+=Q);return 1},write(B,H,O,Q){B=za.get(B)?.memory;if(!B||H+
Q>B.buffer.byteLength)return 0;(new Uint8Array(B.buffer,H,Q)).set(ha.W().subarray(O,O+Q));G.i&&(G.va+=Q);return 1},jj(B,H){B=za.get(B)?.memory;if(!B||H>=B.buffer.byteLength)return-1;B=(new Uint8Array(B.buffer)).indexOf(0,H);return 0>B?-1:B-H},rc(B){return(B=za.get(B)?.memory)?B.buffer.byteLength/65536:0},Yb(){const B=[];for(const H of za.keys()){const O=ha.exports._rive_web_vm_frame_boundary(H);0!==O&&B.push(ha.oa(O))}return B},Pb(B){G.i=!!B;G.l=0;G.ua=0;G.sa=0;G.ta=0;G.va=0},hc(){return{hostCalls:G.l,
bytesStaged:G.ua,bytesCopiedOut:G.sa,bytesRead:G.ta,bytesWritten:G.va}},runJob:function(B,H,O,Q,aa,ia){H=x(H,O,"job");if(null!==H.error)return{ok:!1,error:H.error};O=A(H);if(void 0!==O.error)return{ok:!1,error:O.error};O.ja=B;O.eb=ia;B=V(O,{prefix:vb.job,Ma:Q,input:aa},O.reset);if(void 0!==B.error)return{ok:!1,error:B.error};try{const ma=O.memory.buffer,ja=new Uint32Array(ma,B.result>>>0,2),oa=0===ja[1]?new Uint8Array(0):new Uint8Array(ma,ja[0],ja[1]);void 0!==O.exports.__riveLaneReset&&16777216>=
ma.byteLength&&!ia()&&(O.reset=!0,H.Qa=O);return{ok:!0,output:oa}}catch(ma){return{ok:!1,error:O.Na(ma)}}},workerStart:function(B,H,O,Q,aa,ia){H=x(H,O,"worker");if(null!==H.error)return{ok:!1,error:H.error};Q=na({module:H.module,Ua:"rive_worker_v1",mb:ma=>({finished:(ja,oa,Ia)=>ia.finished(ja,new Uint8Array(ma().buffer,oa>>>0,Ia>>>0)),wait:ia.wait,stopping:ia.ij}),pc:ma=>ha.lc(B,ma),Wa:K(),log:ma=>ha.Sa(B,ma),Oa:()=>S(B),prefix:vb.worker,Ma:Q,input:aa,ca:!0});if(void 0!==Q.error)return{ok:!1,error:Q.error};
aa=Kb++;Ua.set(aa,{wake:Q.exports.__rive_worker_wake,Mb:Q.exports.__riveFrameMinor});return{ok:!0,id:aa}},workerWake:function(B,H,O){try{return Ua.get(B).wake(H,O),null}catch(Q){return N(Q)}},workerCollect:function(B){try{return Ua.get(B)?.Mb?.(),null}catch(H){return N(H)}},workerEnd:function(B){Ua.delete(B)},processorStart:function(B,H,O,Q,aa,ia,ma){H=x(H,O,"processor");if(null!==H.error)return{ok:!1,error:H.error};Q=qa(H.module,Q,aa,ia,K(X,ma),ja=>ha.Sa(B,ja));if(void 0!==Q.error)return{ok:!1,error:Q.error};
aa=Rd++;fb.set(aa,Q.ja);return{ok:!0,id:aa}},processorRender:function(B,H,O,Q){return fb.get(B).xc(H,O,Q)},processorEnd:function(B){fb.delete(B)},audioRefusal:function(){if(void 0===globalThis.nrdp?.audio?.output&&!0!==globalThis.crossOriginIsolated)return"real time audio needs cross origin isolation";if("undefined"===typeof SharedArrayBuffer||!(ha.memory().buffer instanceof SharedArrayBuffer))return"real time audio needs librive built with threads";if("string"!==typeof Ga.audioWorkletUrl)return"real time audio needs riveScripting.audioWorkletUrl";
if("undefined"===typeof AudioContext)return"real time audio needs Web Audio";const B=Ga.audioContext;return"closed"===B?.state?"real time audio cannot start on a closed AudioContext":cc.get(B)?.Xa?"real time audio stalled the host's AudioContext; hand riveScripting a new one":null},audioSampleRate:()=>Ka().context.sampleRate,audioStart:function(B,H,O,Q,aa,ia,ma,ja){const oa=x(H,O,"processor");if(null!==oa.error)return{ok:!1,error:oa.error};O=Ka();const Ia=Aa.next++;B={qc:B,kb:H,Nb:oa,start:{kind:"start",
id:Ia,moduleId:H,entry:Q,input:aa,format:{sampleRate:ia.sampleRate,maxFrames:ia.nc,channels:ia.channels},hardBlocks:ma,sharedOwner:ja}};Aa.X.set(Ia,B);ub(O,B,!O.ea.has(H));mb(O);return{ok:!0,id:Ia}},audioStop:function(B){Aa.X.delete(B);null!==Aa.output&&(Aa.output.Y({kind:"stop",id:B}),mb(Aa.output))},audioState:()=>({context:Aa.output?.context.state??"none",processors:Aa.X.size})};Ga.prepare=Ga.tc;Ga.frameBoundary=Ga.Yb;Ga.countHostCalls=Ga.Pb;Ga.hostCallCounts=Ga.hc;return r.riveScripting=Ga})(I)})();
const Ha=I.onRuntimeInitialized;
I.onRuntimeInitialized=function(){function d(U){this.G=U;this.Bb=U.getContext("2d");this.bb=q;this.O=[];this.ga=0;this.clear=function(){console.assert(0==this.ga);this.O=[];z.delete(this)};this.save=function(){++this.ga;this.O.push(q.save.bind(q))};this.restore=function(){0<this.ga&&(this.O.push(q.restore.bind(q)),--this.ga)};this.transform=function(ba){this.O.push(q.transform.bind(q,ba))};this.align=function(ba,fa,ea,ka,va=1){this.O.push(q.align.bind(q,ba,fa,ea,ka,va))};this.flush=function(){console.assert(0==
this.ga);z.add(this);q.ab||l()};this.bindContext=function(){const ba=this.bb;ba&&ba.T&&La(ba.T)};this["delete"]=function(){}}function e(U,ba=!1,fa=!1){var ea={alpha:!0,depth:ba||fa,stencil:ba||fa,antialias:ba&&!fa,premultipliedAlpha:!0,preserveDrawingBuffer:0,powerPreference:"high-performance",failIfMajorPerformanceCaveat:0,enableExtensionsByDefault:!1,explicitSwapControl:0,renderViaOffscreenBackBuffer:0};ba=U.getContext("webgl2",ea);if(!ba)return null;ea=Ma(ba,ea);La(ea);const ka=C(U.width,U.height);
ka.T=ea;ka.G=U;ka.Ka=U.width;ka.Ja=U.height;ka.P=ba;ka.Ib=function(){this.T&&La(this.T)};var va=ka.delete;ka.delete=function(){this.Ib();va.call(this);var ra=this.T;Na===Oa[ra]&&(Na=null);"object"==typeof JSEvents&&JSEvents.sj(Oa[ra].F.canvas);Oa[ra]?.F.canvas&&(Oa[ra].F.canvas.zb=void 0);this.T=this.G=this.Ka=this.Ja=this.P=Oa[ra]=null};fa&&ka.setInkbleed(!0);return ka}function l(){if(q){var U=q.Db,ba=0,fa=0,ea=0,ka=Array(z.size),va=0;for(var ra of z)ra.aa=Math.min(ra.G.width,U),ra.$=Math.min(ra.G.height,
U),ra.Ha=ra.$*ra.aa,ba=Math.max(ba,ra.aa),fa=Math.max(fa,ra.$),ea+=ra.Ha,ka[va++]=ra;z.clear();if(!(0>=ea)){ba=1<<(0>=ba?0:32-Math.clz32(ba-1));for(fa=1<<(0>=fa?0:32-Math.clz32(fa-1));fa*ba<ea;)ba<=fa?ba*=2:fa*=2;ba=Math.min(ba,U);fa=Math.min(fa,U);ka.sort((nb,vb)=>vb.Ha-nb.Ha);q.cb||(q.cb=new I.DynamicRectanizer(U),q.Ab=new I.Mat2D);ea=q.cb;va=q.Ab;for(var Va=0;Va<ka.length;){ea.reset(ba,fa);for(ra=Va;ra<ka.length;++ra){var wa=ka[ra],ua=ea.addRect(wa.aa,wa.$);if(0>ua){console.assert(ra>Va);break}wa.qa=
ua&65535;wa.ra=ua>>16}wa=J.push(ea.drawWidth());ua=N.push(ea.drawHeight());console.assert(wa>=ea.drawWidth());console.assert(ua>=ea.drawHeight());console.assert(wa<=U);console.assert(ua<=U);q.G.width!=wa&&(q.G.width=wa);q.G.height!=ua&&(q.G.height=ua);q.clear();for(wa=Va;wa<ra;++wa){ua=ka[wa];q.saveClipRect(ua.qa,ua.ra,ua.qa+ua.aa,ua.ra+ua.$);va.xx=ua.aa/ua.G.width;va.yy=ua.$/ua.G.height;va.xy=va.yx=0;va.tx=ua.qa;va.ty=ua.ra;q.transform(va);for(const nb of ua.O)nb();q.restoreClipRect();ua.O=[]}for(q.flush();Va<
ra;++Va)wa=ka[Va],ua=wa.Bb,ua.globalCompositeOperation="copy",ua.drawImage(q.G,wa.qa,wa.ra,wa.aa,wa.$,0,0,wa.G.width,wa.G.height);Va=ra}}}}Ha&&Ha();let q=null;const z=new Set,C=I.makeRenderer;I.makeRenderer=function(U,ba,fa){fa=!(!fa||!fa.inkbleed);if(!q){function ea(ka){var va=document.createElement("canvas");va.width=1;va.height=1;q=e(va,ka);if(!q)return null;q.ab=!!q.P.getExtension("WEBGL_shader_pixel_local_storage");q.Db=Math.min(q.P.getParameter(q.P.MAX_RENDERBUFFER_SIZE),q.P.getParameter(q.P.MAX_TEXTURE_SIZE));
q.Ia=!q.ab;if(ka=q.P.getExtension("WEBGL_debug_renderer_info"))va=q.P.getParameter(ka.UNMASKED_RENDERER_WEBGL),q.P.getParameter(ka.UNMASKED_VENDOR_WEBGL).includes("Google")&&va.includes("ANGLE Metal Renderer")&&(q.Ia=!1);return q}q=ea(!0);if(!q)throw"Unable to create WebGL context, your environment may not support WebGL. Try out @rive-app/canvas as an alternative.";q.Ia||(q=ea(!1))}return ba?new d(U):e(U,q.Ia,fa)};const D=I.Artboard.prototype["delete"];I.Artboard.prototype["delete"]=function(){this.Gb=
!0;D.call(this)};const F=I.Artboard.prototype.draw;I.Artboard.prototype.draw=function(U){U.O?U.O.push(()=>{this.Gb||F.call(this,U.bb)}):F.call(this,U)};const J=new xa,N=new xa,R=new ta;I.requestAnimationFrame=R.requestAnimationFrame.bind(R);I.cancelAnimationFrame=R.cancelAnimationFrame.bind(R);I.enableFPSCounter=R.Tb.bind(R);const T=ya(l);R.lb=T;I.resolveAnimationFrame=T;let V=I.load;I.load=function(U,ba,fa=!0,ea=null){const ka=new I.FallbackFileAssetLoader;void 0!==ba&&ka.addLoader(ba);fa&&(ba=new I.CDNFileAssetLoader(ea),
ka.addLoader(ba));return I.startFileScripts(V(U,ka,ea??null))};const na=I.WebGL2Renderer.prototype.clear;I.WebGL2Renderer.prototype.clear=function(){La(this.T);const U=this.G;if(this.Ka!=U.width||this.Ja!=U.height)this.resize(U.width,U.height),this.Ka=U.width,this.Ja=U.height;na.call(this)};I.decodeImage=function(U,ba,fa=null){U=I.decodeWebGL2Image(U,fa??null);ba(U)};let qa=I.Renderer.prototype.align;I.Renderer.prototype.align=function(U,ba,fa,ea,ka=1){qa.call(this,U,ba,fa,ea,ka)}};var Pa="./this.program";
sa&&(_scriptName=self.location.href);var Qa="",Ra,Wa;
if(la||sa){try{Qa=(new URL(".",_scriptName)).href}catch{}sa&&(Wa=d=>{var e=new XMLHttpRequest;e.open("GET",d,!1);e.responseType="arraybuffer";e.send(null);return new Uint8Array(e.response)});Ra=async d=>{if(Xa(d))return new Promise((l,q)=>{var z=new XMLHttpRequest;z.open("GET",d,!0);z.responseType="arraybuffer";z.onload=()=>{200==z.status||0==z.status&&z.response?l(z.response):q(z.status)};z.onerror=q;z.send(null)});var e=await fetch(d,{credentials:"same-origin"});if(e.ok)return e.arrayBuffer();throw Error(e.status+
" : "+e.url);}}var Ya=console.log.bind(console),Za=console.error.bind(console),$a,ab=!1,Xa=d=>d.startsWith("file://"),bb,cb,db,eb,hb,ib,L,jb,kb,lb,pb=!1;function qb(){var d=rb.buffer;I.HEAP8=db=new Int8Array(d);hb=new Int16Array(d);I.HEAPU8=eb=new Uint8Array(d);I.HEAPU16=ib=new Uint16Array(d);I.HEAP32=L=new Int32Array(d);I.HEAPU32=jb=new Uint32Array(d);I.HEAPF32=kb=new Float32Array(d);lb=new Float64Array(d)}
function sb(d){I.onAbort?.(d);d="Aborted("+d+")";Za(d);ab=!0;d=new WebAssembly.RuntimeError(d+". Build with -sASSERTIONS for more info.");cb?.(d);throw d;}var tb;async function wb(d){if(!$a)try{var e=await Ra(d);return new Uint8Array(e)}catch{}if(d==tb&&$a)d=new Uint8Array($a);else if(Wa)d=Wa(d);else throw"both async and sync fetching of the wasm failed";return d}
async function xb(d,e){try{var l=await wb(d);return await WebAssembly.instantiate(l,e)}catch(q){Za(`failed to asynchronously prepare wasm: ${q}`),sb(q)}}async function yb(d){var e=tb;if(!$a&&!Xa(e))try{var l=fetch(e,{credentials:"same-origin"});return await WebAssembly.instantiateStreaming(l,d)}catch(q){Za(`wasm streaming compile failed: ${q}`),Za("falling back to ArrayBuffer instantiation")}return xb(e,d)}
var zb,Ab,Bb=d=>{for(;0<d.length;)d.shift()(I)},Cb=[],Db=[],Eb=()=>{var d=I.preRun.shift();Db.push(d)},Gb=d=>Fb(d),Ib=()=>Hb(),Jb=globalThis.TextDecoder&&new TextDecoder,Mb=(d,e,l,q)=>{l=e+l;if(q)return l;for(;d[e]&&!(e>=l);)++e;return e},Nb=(d,e=0,l,q)=>{l=Mb(d,e,l,q);if(16<l-e&&d.buffer&&Jb)return Jb.decode(d.subarray(e,l));for(q="";e<l;){var z=d[e++];if(z&128){var C=d[e++]&63;if(192==(z&224))q+=String.fromCharCode((z&31)<<6|C);else{var D=d[e++]&63;z=224==(z&240)?(z&15)<<12|C<<6|D:(z&7)<<18|C<<
12|D<<6|d[e++]&63;65536>z?q+=String.fromCharCode(z):(z-=65536,q+=String.fromCharCode(55296|z>>10,56320|z&1023))}}else q+=String.fromCharCode(z)}return q},Ob=(d,e)=>Object.defineProperty(e,"name",{value:d}),Pb=[],Qb=[0,1,,1,null,1,!0,1,!1,1],Rb=class extends Error{constructor(d){super(d);this.name="BindingError"}},Sb=d=>{if(!d)throw new Rb(`Cannot use deleted val. handle = ${d}`);return Qb[d]},Tb=d=>{switch(d){case void 0:return 2;case null:return 4;case !0:return 6;case !1:return 8;default:const e=
Pb.pop()||Qb.length;Qb[e]=d;Qb[e+1]=1;return e}};class Ub extends Error{}
var Vb=d=>{for(var e="";;){var l=eb[d++];if(!l)return e;e+=String.fromCharCode(l)}},Wb={},Xb=(d,e)=>{if(void 0===e)throw new Rb("ptr should not be undefined");for(;d.C;)e=d.na(e),d=d.C;return e},Yb={},ec=d=>{d=Zb(d);var e=Vb(d);$b(d);return e},fc=(d,e)=>{var l=Yb[d];if(void 0===l)throw d=`${e} has unknown type ${ec(d)}`,new Rb(d);return l},gc=()=>{},hc=!1,ic=d=>{if(!globalThis.FinalizationRegistry)return ic=e=>e,d;hc=new FinalizationRegistry(e=>{e=e.m;--e.count.value;0===e.count.value&&(e.D?e.K.N(e.D):
e.v.o.N(e.u))});ic=e=>{var l=e.m;l.D&&hc.register(e,{m:l},e);return e};gc=e=>{hc.unregister(e)};return ic(d)},jc={},kc=d=>{for(;d.length;){var e=d.pop();d.pop()(e)}};function lc(d){return this.s(jb[d>>2])}
var mc={},nc={},oc=class extends Error{constructor(d){super(d);this.name="InternalError"}},qc=(d,e,l)=>{function q(F){F=l(F);if(F.length!==d.length)throw new oc("Mismatched type converter count");for(var J=0;J<d.length;++J)pc(d[J],F[J])}d.forEach(F=>nc[F]=e);var z=Array(e.length),C=[],D=0;for(let [F,J]of e.entries())Yb.hasOwnProperty(J)?z[F]=Yb[J]:(C.push(J),mc.hasOwnProperty(J)||(mc[J]=[]),mc[J].push(()=>{z[F]=Yb[J];++D;D===C.length&&q(z)}));0===C.length&&q(z)};
function rc(d,e,l={}){var q=e.name;if(!d)throw new Rb(`type "${q}" must have a positive integer typeid pointer`);if(Yb.hasOwnProperty(d)){if(l.ic)return;throw new Rb(`Cannot register type '${q}' twice`);}Yb[d]=e;delete nc[d];mc.hasOwnProperty(d)&&(e=mc[d],delete mc[d],e.forEach(z=>z()))}function pc(d,e,l={}){return rc(d,e,l)}var sc=d=>{throw new Rb(d.m.v.o.name+" instance already deleted");},tc=[];function uc(){}
var vc={},wc=(d,e,l)=>{if(void 0===d[e].A){var q=d[e];d[e]=function(...z){if(!d[e].A.hasOwnProperty(z.length))throw new Rb(`Function '${l}' called with an invalid number of arguments (${z.length}) - expects one of (${d[e].A})!`);return d[e].A[z.length].apply(this,z)};d[e].A=[];d[e].A[q.R]=q}},xc=(d,e,l)=>{if(I.hasOwnProperty(d)){if(void 0===l||void 0!==I[d].A&&void 0!==I[d].A[l])throw new Rb(`Cannot register public name '${d}' twice`);wc(I,d,d);if(I[d].A.hasOwnProperty(l))throw new Rb(`Cannot register multiple overloads of a function with the same number of arguments (${l})!`);
I[d].A[l]=e}else I[d]=e,I[d].R=l},yc=d=>{d=d.replace(/[^a-zA-Z0-9_]/g,"$");var e=d.charCodeAt(0);return 48<=e&&57>=e?`_${d}`:d};function zc(d,e,l,q,z,C,D,F){this.name=d;this.constructor=e;this.M=l;this.N=q;this.C=z;this.$b=C;this.na=D;this.Rb=F;this.ob=[]}
var Ac=(d,e,l)=>{for(;e!==l;){if(!e.na)throw new Rb(`Expected null or instance of ${l.name}, got an instance of ${e.name}`);d=e.na(d);e=e.C}return d},Bc=d=>{if(null===d)return"null";var e=typeof d;return"object"===e||"array"===e||"function"===e?d.toString():""+d};
function Cc(d,e){if(null===e){if(this.Pa)throw new Rb(`null is not a valid ${this.name}`);return 0}if(!e.m)throw new Rb(`Cannot pass "${Bc(e)}" as a ${this.name}`);if(!e.m.u)throw new Rb(`Cannot pass deleted object as a pointer of type ${this.name}`);return Ac(e.m.u,e.m.v.o,this.o)}
function Dc(d,e){if(null===e){if(this.Pa)throw new Rb(`null is not a valid ${this.name}`);if(this.za){var l=this.Va();null!==d&&d.push(this.N,l);return l}return 0}if(!e||!e.m)throw new Rb(`Cannot pass "${Bc(e)}" as a ${this.name}`);if(!e.m.u)throw new Rb(`Cannot pass deleted object as a pointer of type ${this.name}`);if(!this.ya&&e.m.v.ya)throw new Rb(`Cannot convert argument of type ${e.m.K?e.m.K.name:e.m.v.name} to parameter type ${this.name}`);l=Ac(e.m.u,e.m.v.o,this.o);if(this.za){if(void 0===
e.m.D)throw new Rb("Passing raw pointer to smart pointer is illegal");switch(this.hj){case 0:if(e.m.K===this)l=e.m.D;else throw new Rb(`Cannot convert argument of type ${e.m.K?e.m.K.name:e.m.v.name} to parameter type ${this.name}`);break;case 1:l=e.m.D;break;case 2:if(e.m.K===this)l=e.m.D;else{var q=e.clone();l=this.wc(l,Tb(()=>q["delete"]()));null!==d&&d.push(this.N,l)}break;default:throw new Rb("Unsupported sharing policy");}}return l}
function Ec(d,e){if(null===e){if(this.Pa)throw new Rb(`null is not a valid ${this.name}`);return 0}if(!e.m)throw new Rb(`Cannot pass "${Bc(e)}" as a ${this.name}`);if(!e.m.u)throw new Rb(`Cannot pass deleted object as a pointer of type ${this.name}`);if(e.m.v.ya)throw new Rb(`Cannot convert argument of type ${e.m.v.name} to parameter type ${this.name}`);return Ac(e.m.u,e.m.v.o,this.o)}
var Jc=(d,e,l)=>{if(e===l)return d;if(void 0===l.C)return null;d=Jc(d,e,l.C);return null===d?null:l.Rb(d)},Kc=(d,e)=>{e=Xb(d,e);return Wb[e]},Lc=(d,e)=>{if(!e.v||!e.u)throw new oc("makeClassHandle requires ptr and ptrType");if(!!e.K!==!!e.D)throw new oc("Both smartPtrType and smartPtr must be specified");e.count={value:1};return ic(Object.create(d,{m:{value:e,writable:!0}}))};
function Mc(d,e,l,q,z,C,D,F,J,N,R){this.name=d;this.o=e;this.Pa=l;this.ya=q;this.za=z;this.sc=C;this.hj=D;this.rb=F;this.Va=J;this.wc=N;this.N=R;z||void 0!==e.C?this.B=Dc:(this.B=q?Cc:Ec,this.H=null)}
var Nc=(d,e,l)=>{if(!I.hasOwnProperty(d))throw new oc("Replacing nonexistent public symbol");void 0!==I[d].A&&void 0!==l?I[d].A[l]=e:(I[d]=e,I[d].R=l)},Oc={},Qc=(d,e,l=[])=>{d.includes("j")?(d=d.replace(/p/g,"i"),e=(0,Oc[d])(e,...l)):e=Pc.get(e)(...l);return e},Rc=(d,e)=>(...l)=>Qc(d,e,l),Sc=(d,e)=>{d=Vb(d);var l=d.includes("j")?Rc(d,e):Pc.get(e);if("function"!=typeof l)throw new Rb(`unknown function pointer with signature ${d}: ${e}`);return l};class Tc extends Error{}
var Uc=(d,e)=>{function l(C){z[C]||Yb[C]||(nc[C]?nc[C].forEach(l):(q.push(C),z[C]=!0))}var q=[],z={};e.forEach(l);throw new Tc(`${d}: `+q.map(ec).join([", "]));};function Vc(d){for(var e=1;e<d.length;++e)if(null!==d[e]&&void 0===d[e].H)return!0;return!1}
function Wc(d,e,l,q,z){var C=e.length;if(2>C)throw new Rb("argTypes array size mismatch! Must at least get return value and 'this' types!");var D=null!==e[1]&&null!==l,F=Vc(e),J=!e[0].kc,N=C-2,R=Array(N),T=[],V=[];return Ob(d,function(...na){V.length=0;T.length=D?2:1;T[0]=z;if(D){var qa=e[1].B(V,this);T[1]=qa}for(var U=0;U<N;++U)R[U]=e[U+2].B(V,na[U]),T.push(R[U]);na=q(...T);if(F)kc(V);else for(U=D?1:2;U<e.length;U++){var ba=1===U?qa:R[U-2];null!==e[U].H&&e[U].H(ba)}qa=J?e[0].s(na):void 0;return qa})}
var Xc=(d,e)=>{for(var l=[],q=0;q<d;q++)l.push(jb[e+4*q>>2]);return l},Yc=d=>{d=d.trim();const e=d.indexOf("(");return-1===e?d:d.slice(0,e)},Zc=(d,e,l)=>{if(!(d instanceof Object))throw new Rb(`${l} with invalid "this": ${d}`);if(!(d instanceof e.o.constructor))throw new Rb(`${l} incompatible with "this" of type ${d.constructor.name}`);if(!d.m.u)throw new Rb(`cannot call emscripten binding method ${l} on deleted object`);return Ac(d.m.u,d.m.v.o,e.o)},$c=d=>{9<d&&0===--Qb[d+1]&&(Qb[d]=void 0,Pb.push(d))},
ad={name:"emscripten::val",s:d=>{var e=Sb(d);$c(d);return e},B:(d,e)=>Tb(e),J:lc,H:null},bd=(d,e,l)=>{switch(e){case 1:return l?function(q){return this.s(db[q])}:function(q){return this.s(eb[q])};case 2:return l?function(q){return this.s(hb[q>>1])}:function(q){return this.s(ib[q>>1])};case 4:return l?function(q){return this.s(L[q>>2])}:function(q){return this.s(jb[q>>2])};default:throw new TypeError(`invalid integer width (${e}): ${d}`);}},cd=(d,e)=>{switch(e){case 4:return function(l){return this.s(kb[l>>
2])};case 8:return function(l){return this.s(lb[l>>3])};default:throw new TypeError(`invalid float width (${e}): ${d}`);}},dd=(d,e,l)=>{switch(e){case 1:return l?q=>db[q]:q=>eb[q];case 2:return l?q=>hb[q>>1]:q=>ib[q>>1];case 4:return l?q=>L[q>>2]:q=>jb[q>>2];default:throw new TypeError(`invalid integer width (${e}): ${d}`);}},ed=(d,e,l)=>{var q=eb;if(!(0<l))return 0;var z=e;l=e+l-1;for(var C=0;C<d.length;++C){var D=d.codePointAt(C);if(127>=D){if(e>=l)break;q[e++]=D}else if(2047>=D){if(e+1>=l)break;
q[e++]=192|D>>6;q[e++]=128|D&63}else if(65535>=D){if(e+2>=l)break;q[e++]=224|D>>12;q[e++]=128|D>>6&63;q[e++]=128|D&63}else{if(e+3>=l)break;q[e++]=240|D>>18;q[e++]=128|D>>12&63;q[e++]=128|D>>6&63;q[e++]=128|D&63;C++}}q[e]=0;return e-z},fd=d=>{for(var e=0,l=0;l<d.length;++l){var q=d.charCodeAt(l);127>=q?e++:2047>=q?e+=2:55296<=q&&57343>=q?(e+=4,++l):e+=3}return e},gd=globalThis.TextDecoder?new TextDecoder("utf-16le"):void 0,hd=(d,e,l)=>{d>>=1;e=Mb(ib,d,e/2,l);if(16<e-d&&gd)return gd.decode(ib.subarray(d,
e));for(l="";d<e;++d)l+=String.fromCharCode(ib[d]);return l},jd=(d,e,l)=>{l??=2147483647;if(2>l)return 0;l-=2;var q=e;l=l<2*d.length?l/2:d.length;for(var z=0;z<l;++z)hb[e>>1]=d.charCodeAt(z),e+=2;hb[e>>1]=0;return e-q},kd=d=>2*d.length,ld=(d,e,l)=>{var q="";d>>=2;for(var z=0;!(z>=e/4);z++){var C=jb[d+z];if(!C&&!l)break;q+=String.fromCodePoint(C)}return q},md=(d,e,l)=>{l??=2147483647;if(4>l)return 0;var q=e;l=q+l-4;for(var z=0;z<d.length;++z){var C=d.codePointAt(z);65535<C&&z++;L[e>>2]=C;e+=4;if(e+
4>l)break}L[e>>2]=0;return e-q},nd=d=>{for(var e=0,l=0;l<d.length;++l)65535<d.codePointAt(l)&&l++,e+=4;return e},od=[],pd=d=>{var e=od.length;od.push(d);return e},qd=(d,e)=>{for(var l=Array(d),q=0;q<d;++q)l[q]=fc(jb[e+4*q>>2],`parameter ${q}`);return l},rd={},sd=d=>{var e=rd[d];return void 0===e?Vb(d):e},td=[0,31,60,91,121,152,182,213,244,274,305,335],ud=[0,31,59,90,120,151,181,212,243,273,304,334],vd=[],wd=d=>{d.mj=d.getExtension("WEBGL_draw_instanced_base_vertex_base_instance")},xd=d=>{d.qj=d.getExtension("WEBGL_multi_draw_instanced_base_vertex_base_instance")},
Z,yd=d=>{var e="EXT_color_buffer_float EXT_conservative_depth EXT_disjoint_timer_query_webgl2 EXT_texture_norm16 NV_shader_noperspective_interpolation WEBGL_clip_cull_distance EXT_clip_control EXT_color_buffer_half_float EXT_depth_clamp EXT_float_blend EXT_polygon_offset_clamp EXT_texture_compression_bptc EXT_texture_compression_rgtc EXT_texture_filter_anisotropic KHR_parallel_shader_compile OES_texture_float_linear WEBGL_blend_func_extended WEBGL_compressed_texture_astc WEBGL_compressed_texture_etc WEBGL_compressed_texture_etc1 WEBGL_compressed_texture_s3tc WEBGL_compressed_texture_s3tc_srgb WEBGL_debug_renderer_info WEBGL_debug_shaders WEBGL_lose_context WEBGL_multi_draw WEBGL_polygon_mode".split(" ");
return(d.getSupportedExtensions()||[]).filter(l=>e.includes(l))},zd=1,Ad=[],Bd=[],Cd=[],Dd=[],Ed=[],Fd=[],Gd=[],Oa=[],Hd=[],Id=[],Jd={},Kd={},Sd=4,Td=0,Ud=d=>{for(var e=zd++,l=d.length;l<e;l++)d[l]=null;return e},Wd=(d,e,l,q)=>{for(var z=0;z<d;z++){var C=Z[l](),D=C&&Ud(q);C?(C.name=D,q[D]=C):Vd||=1282;L[e+4*z>>2]=D}},Ma=(d,e)=>{var l=Ud(Oa),q={handle:l,attributes:e,version:e.pj,F:d};d.canvas&&(d.canvas.zb=q);Oa[l]=q;if("undefined"==typeof e.Sb||e.Sb)if((d=q)||(d=Na),!d.jc){d.jc=!0;e=d.F;e.oc=e.getExtension("WEBGL_multi_draw");
e.Vb=e.getExtension("EXT_polygon_offset_clamp");e.Ub=e.getExtension("EXT_clip_control");e.kj=e.getExtension("WEBGL_polygon_mode");wd(e);xd(e);2<=d.version&&(e.gb=e.getExtension("EXT_disjoint_timer_query_webgl2"));if(2>d.version||!e.gb)e.gb=e.getExtension("EXT_disjoint_timer_query");for(var z of yd(e))z.includes("lose_context")||z.includes("debug")||e.getExtension(z)}return l},La=d=>{Na=Oa[d];I.ctx=Z=Na?.F;return!(d&&!Z)},Vd,Na,Xd={},Zd=()=>{if(!Yd){var d={USER:"web_user",LOGNAME:"web_user",PATH:"/",
PWD:"/",HOME:"/home/web_user",LANG:(globalThis.navigator?.language??"C").replace("-","_")+".UTF-8",_:Pa||"./this.program"},e;for(e in Xd)void 0===Xd[e]?delete d[e]:d[e]=Xd[e];var l=[];for(e in d)l.push(`${e}=${d[e]}`);Yd=l}return Yd},Yd,$d=[null,[],[]],ae=[],be=()=>{var d=yd(Z);return d=d.concat(d.map(e=>"GL_"+e))},ce=(d,e,l)=>{if(e){var q=void 0;switch(d){case 36346:q=1;break;case 36344:0!=l&&1!=l&&(Vd||=1280);return;case 34814:case 36345:q=0;break;case 34466:var z=Z.getParameter(34467);q=z?z.length:
0;break;case 33309:if(2>Na.version){Vd||=1282;return}q=be().length;break;case 33307:case 33308:if(2>Na.version){Vd||=1280;return}q=33307==d?3:0}if(void 0===q)switch(z=Z.getParameter(d),typeof z){case "number":q=z;break;case "boolean":q=z?1:0;break;case "string":Vd||=1280;return;case "object":if(null===z)switch(d){case 34964:case 35725:case 34965:case 36006:case 36007:case 32873:case 34229:case 36662:case 36663:case 35053:case 35055:case 36010:case 35097:case 35869:case 32874:case 36389:case 35983:case 35368:case 34068:q=
0;break;default:Vd||=1280;return}else{if(z instanceof Float32Array||z instanceof Uint32Array||z instanceof Int32Array||z instanceof Array){for(d=0;d<z.length;++d)switch(l){case 0:L[e+4*d>>2]=z[d];break;case 2:kb[e+4*d>>2]=z[d];break;case 4:db[e+d]=z[d]?1:0}return}try{q=z.name|0}catch(C){Vd||=1280;Za(`GL_INVALID_ENUM in glGet${l}v: Unknown object returned from WebGL getParameter(${d})! (error: ${C})`);return}}break;default:Vd||=1280;Za(`GL_INVALID_ENUM in glGet${l}v: Native code calling glGet${l}v(${d}) and it returns ${z} of type ${typeof z}!`);
return}switch(l){case 1:l=q;jb[e>>2]=l;jb[e+4>>2]=(l-jb[e>>2])/4294967296;break;case 0:L[e>>2]=q;break;case 2:kb[e>>2]=q;break;case 4:db[e]=q?1:0}}else Vd||=1281},ee=d=>{var e=fd(d)+1,l=de(e);l&&ed(d,l,e);return l},fe=d=>"]"==d.slice(-1)&&d.lastIndexOf("["),ge=d=>{d-=5120;return 0==d?db:1==d?eb:2==d?hb:4==d?L:6==d?kb:5==d||28922==d||28520==d||30779==d||30782==d?jb:ib},ie=d=>he(d);
(()=>{let d=uc.prototype;Object.assign(d,{isAliasOf:function(l){if(!(this instanceof uc&&l instanceof uc))return!1;var q=this.m.v.o,z=this.m.u;l.m=l.m;var C=l.m.v.o;for(l=l.m.u;q.C;)z=q.na(z),q=q.C;for(;C.C;)l=C.na(l),C=C.C;return q===C&&z===l},clone:function(){this.m.u||sc(this);if(this.m.da)return this.m.count.value+=1,this;var l=ic,q=Object,z=q.create,C=Object.getPrototypeOf(this),D=this.m;l=l(z.call(q,C,{m:{value:{count:D.count,ha:D.ha,da:D.da,u:D.u,v:D.v,D:D.D,K:D.K}}}));l.m.count.value+=1;l.m.ha=
!1;return l},["delete"](){this.m.u||sc(this);if(this.m.ha&&!this.m.da)throw new Rb("Object already scheduled for deletion");gc(this);var l=this.m;--l.count.value;0===l.count.value&&(l.D?l.K.N(l.D):l.v.o.N(l.u));this.m.da||(this.m.D=void 0,this.m.u=void 0)},isDeleted:function(){return!this.m.u},deleteLater:function(){this.m.u||sc(this);if(this.m.ha&&!this.m.da)throw new Rb("Object already scheduled for deletion");tc.push(this);this.m.ha=!0;return this}});const e=Symbol.dispose;e&&(d[e]=d["delete"])})();
Object.assign(Mc.prototype,{ac(d){this.rb&&(d=this.rb(d));return d},fb(d){this.N?.(d)},J:lc,s:function(d){function e(){return this.za?Lc(this.o.M,{v:this.sc,u:l,K:this,D:d}):Lc(this.o.M,{v:this,u:d})}var l=this.ac(d);if(!l)return this.fb(d),null;var q=Kc(this.o,l);if(void 0!==q){if(0===q.m.count.value)return q.m.u=l,q.m.D=d,q.clone();q=q.clone();this.fb(d);return q}q=this.o.$b(l);q=vc[q];if(!q)return e.call(this);q=this.ya?q.Ob:q.pointerType;var z=Jc(l,this.o,q.o);return null===z?e.call(this):this.za?
Lc(q.o.M,{v:q,u:z,K:this,D:d}):Lc(q.o.M,{v:q,u:z})}});for(let d=0;32>d;++d)ae.push(Array(d));I.print&&(Ya=I.print);I.printErr&&(Za=I.printErr);I.wasmBinary&&($a=I.wasmBinary);I.thisProgram&&(Pa=I.thisProgram);if(I.preInit)for("function"==typeof I.preInit&&(I.preInit=[I.preInit]);0<I.preInit.length;)I.preInit.shift()();
var me={359126:(d,e,l,q,z)=>{if("undefined"===typeof window||void 0===(window.AudioContext||window.webkitAudioContext))return 0;if("undefined"===typeof window.miniaudio){window.miniaudio={referenceCount:0};window.miniaudio.device_type={};window.miniaudio.device_type.playback=d;window.miniaudio.device_type.capture=e;window.miniaudio.device_type.duplex=l;window.miniaudio.device_state={};window.miniaudio.device_state.stopped=q;window.miniaudio.device_state.started=z;let C=window.miniaudio;C.devices=
[];C.track_device=function(D){for(var F=0;F<C.devices.length;++F)if(null==C.devices[F])return C.devices[F]=D,F;C.devices.push(D);return C.devices.length-1};C.untrack_device_by_index=function(D){for(C.devices[D]=null;0<C.devices.length;)if(null==C.devices[C.devices.length-1])C.devices.pop();else break};C.untrack_device=function(D){for(var F=0;F<C.devices.length;++F)if(C.devices[F]==D)return C.untrack_device_by_index(F)};C.get_device_by_index=function(D){return C.devices[D]};C.unlock_event_types=["touchend",
"click"];C.unlock=function(){for(var D=0;D<C.devices.length;++D){var F=C.devices[D];null!=F&&null!=F.L&&F.state===C.device_state.started&&F.L.resume().then(()=>{je(F.nb)},J=>{console.error("Failed to resume audiocontext",J)})}C.unlock_event_types.map(function(J){document.removeEventListener(J,C.unlock,!0)})};C.unlock_event_types.map(function(D){document.addEventListener(D,C.unlock,!0)})}window.miniaudio.referenceCount+=1;return 1},361304:()=>{"undefined"!==typeof window.miniaudio&&(window.miniaudio.unlock_event_types.map(function(d){document.removeEventListener(d,
window.miniaudio.unlock,!0)}),--window.miniaudio.referenceCount,0===window.miniaudio.referenceCount&&delete window.miniaudio)},361608:()=>void 0!==navigator.mediaDevices&&void 0!==navigator.mediaDevices.getUserMedia,361712:()=>{try{var d=new (window.AudioContext||window.webkitAudioContext),e=d.sampleRate;d.close();return e}catch(l){return 0}},361883:(d,e,l,q,z,C)=>{if("undefined"===typeof window.miniaudio)return-1;var D={},F={};d==window.miniaudio.device_type.playback&&0!=l&&(F.sampleRate=l);D.L=
new (window.AudioContext||window.webkitAudioContext)(F);D.L.suspend();D.state=window.miniaudio.device_state.stopped;l=0;d!=window.miniaudio.device_type.playback&&(l=e);D.S=D.L.createScriptProcessor(q,l,e);D.S.onaudioprocess=function(J){if(null==D.xa||0==D.xa.length)D.xa=new Float32Array(kb.buffer,z,q*e);if(d==window.miniaudio.device_type.capture||d==window.miniaudio.device_type.duplex){for(var N=0;N<e;N+=1)for(var R=J.inputBuffer.getChannelData(N),T=D.xa,V=0;V<q;V+=1)T[V*e+N]=R[V];ke(C,q,z)}if(d==
window.miniaudio.device_type.playback||d==window.miniaudio.device_type.duplex)for(le(C,q,z),N=0;N<J.outputBuffer.numberOfChannels;++N)for(R=J.outputBuffer.getChannelData(N),T=D.xa,V=0;V<q;V+=1)R[V]=T[V*e+N];else for(N=0;N<J.outputBuffer.numberOfChannels;++N)J.outputBuffer.getChannelData(N).fill(0)};d!=window.miniaudio.device_type.capture&&d!=window.miniaudio.device_type.duplex||navigator.mediaDevices.getUserMedia({audio:!0,video:!1}).then(function(J){D.Fa=D.L.createMediaStreamSource(J);D.Fa.connect(D.S);
D.S.connect(D.L.destination)}).catch(function(J){console.log("Failed to get user media: "+J)});d==window.miniaudio.device_type.playback&&D.S.connect(D.L.destination);D.nb=C;return window.miniaudio.track_device(D)},364760:d=>window.miniaudio.get_device_by_index(d).L.sampleRate,364833:d=>{d=window.miniaudio.get_device_by_index(d);void 0!==d.S&&(d.S.onaudioprocess=function(){},d.S.disconnect(),d.S=void 0);void 0!==d.Fa&&(d.Fa.disconnect(),d.Fa=void 0);d.L.close();d.L=void 0;d.nb=void 0},365233:d=>{window.miniaudio.untrack_device_by_index(d)},
365283:d=>{d=window.miniaudio.get_device_by_index(d);d.L.resume();d.state=window.miniaudio.device_state.started},365422:d=>{d=window.miniaudio.get_device_by_index(d);d.L.suspend();d.state=window.miniaudio.device_state.stopped}},$b,de,Zb,ne,oe,pe,qe,re,se,te,ue,ve,we,xe,je,ke,le,ye,ze,Fb,he,Hb,rb,Pc,Be={__syscall_fcntl64:function(){return 0},__syscall_ioctl:function(){return 0},__syscall_openat:function(){},_abort_js:()=>sb(""),_embind_create_inheriting_constructor:(d,e,l)=>{d=Vb(d);e=fc(e,"wrapper");
l=Sb(l);var q=e.o,z=q.M,C=q.C.M,D=q.C.constructor;d=Ob(d,function(...F){for(var J of q.C.ob)if(this[J]===C[J])throw new Ub(`Pure virtual function ${J} must be implemented in JavaScript`);Object.defineProperty(this,"__parent",{value:z});this.__construct(...F)});z.__construct=function(...F){if(this===z)throw new Rb("Pass correct 'this' to __construct");F=D.implement(this,...F);gc(F);var J=F.m;F.notifyOnDestruction();J.da=!0;Object.defineProperties(this,{m:{value:J}});ic(this);F=J.u;F=Xb(q,F);if(Wb.hasOwnProperty(F))throw new Rb(`Tried to register registered instance: ${F}`);
Wb[F]=this};z.__destruct=function(){if(this===z)throw new Rb("Pass correct 'this' to __destruct");gc(this);var F=this.m.u;F=Xb(q,F);if(Wb.hasOwnProperty(F))delete Wb[F];else throw new Rb(`Tried to unregister unregistered instance: ${F}`);};d.prototype=Object.create(z);Object.assign(d.prototype,l);return Tb(d)},_embind_finalize_value_object:d=>{var e=jc[d];delete jc[d];var l=e.Va,q=e.N,z=e.hb,C=z.map(D=>D.dc).concat(z.map(D=>D.fj));qc([d],C,D=>{var F={},J,N;for([J,N]of z.entries()){const R=D[J],T=
N.bc,V=N.cc,na=D[J+z.length],qa=N.ej,U=N.gj;F[N.Xb]={read:ba=>R.s(T(V,ba)),write:(ba,fa)=>{var ea=[];qa(U,ba,na.B(ea,fa));kc(ea)},optional:R.optional}}return[{name:e.name,s:R=>{var T={},V;for(V in F)T[V]=F[V].read(R);q(R);return T},B:(R,T)=>{for(var V in F)if(!(V in T||F[V].optional))throw new TypeError(`Missing field: "${V}"`);var na=l();for(V in F)F[V].write(na,T[V]);null!==R&&R.push(q,na);return na},J:lc,H:q}]})},_embind_register_bigint:()=>{},_embind_register_bool:(d,e,l,q)=>{e=Vb(e);pc(d,{name:e,
s:function(z){return!!z},B:function(z,C){return C?l:q},J:function(z){return this.s(eb[z])},H:null})},_embind_register_class:(d,e,l,q,z,C,D,F,J,N,R,T,V)=>{R=Vb(R);C=Sc(z,C);F&&=Sc(D,F);N&&=Sc(J,N);V=Sc(T,V);var na=yc(R);xc(na,function(){Uc(`Cannot construct ${R} due to unbound types`,[q])});qc([d,e,l],q?[q]:[],qa=>{qa=qa[0];if(q){var U=qa.o;var ba=U.M}else ba=uc.prototype;qa=Ob(R,function(...va){if(Object.getPrototypeOf(this)!==fa)throw new Rb(`Use 'new' to construct ${R}`);if(void 0===ea.V)throw new Rb(`${R} has no accessible constructor`);
var ra=ea.V[va.length];if(void 0===ra)throw new Rb(`Tried to invoke ctor of ${R} with invalid number of parameters (${va.length}) - expected (${Object.keys(ea.V).toString()}) parameters instead!`);return ra.apply(this,va)});var fa=Object.create(ba,{constructor:{value:qa}});qa.prototype=fa;var ea=new zc(R,qa,fa,V,U,C,F,N);if(ea.C){var ka;(ka=ea.C).pa??(ka.pa=[]);ea.C.pa.push(ea)}U=new Mc(R,ea,!0,!1,!1);ka=new Mc(R+"*",ea,!1,!1,!1);ba=new Mc(R+" const*",ea,!1,!0,!1);vc[d]={pointerType:ka,Ob:ba};Nc(na,
qa);return[U,ka,ba]})},_embind_register_class_class_function:(d,e,l,q,z,C,D)=>{var F=Xc(l,q);e=Vb(e);e=Yc(e);C=Sc(z,C);qc([],[d],J=>{function N(){Uc(`Cannot call ${R} due to unbound types`,F)}J=J[0];var R=`${J.name}.${e}`;e.startsWith("@@")&&(e=Symbol[e.substring(2)]);var T=J.o.constructor;void 0===T[e]?(N.R=l-1,T[e]=N):(wc(T,e,R),T[e].A[l-1]=N);qc([],F,V=>{V=Wc(R,[V[0],null].concat(V.slice(1)),null,C,D);void 0===T[e].A?(V.R=l-1,T[e]=V):T[e].A[l-1]=V;if(J.o.pa)for(const na of J.o.pa)na.constructor.hasOwnProperty(e)||
(na.constructor[e]=V);return[]});return[]})},_embind_register_class_class_property:(d,e,l,q,z,C,D,F)=>{e=Vb(e);C=Sc(z,C);qc([],[d],J=>{J=J[0];var N=`${J.name}.${e}`,R={get(){Uc(`Cannot access ${N} due to unbound types`,[l])},enumerable:!0,configurable:!0};R.set=F?()=>{Uc(`Cannot access ${N} due to unbound types`,[l])}:()=>{throw new Rb(`${N} is a read-only property`);};Object.defineProperty(J.o.constructor,e,R);qc([],[l],T=>{T=T[0];var V={get(){return T.s(C(q))},enumerable:!0};F&&(F=Sc(D,F),V.set=
na=>{var qa=[];F(q,T.B(qa,na));kc(qa)});Object.defineProperty(J.o.constructor,e,V);return[]});return[]})},_embind_register_class_constructor:(d,e,l,q,z,C)=>{var D=Xc(e,l);z=Sc(q,z);qc([],[d],F=>{F=F[0];var J=`constructor ${F.name}`;void 0===F.o.V&&(F.o.V=[]);if(void 0!==F.o.V[e-1])throw new Rb(`Cannot register multiple constructors with identical number of parameters (${e-1}) for class '${F.name}'! Overload resolution is currently only performed using the parameter count, not actual type info!`);
F.o.V[e-1]=()=>{Uc(`Cannot construct ${F.name} due to unbound types`,D)};qc([],D,N=>{N.splice(1,0,null);F.o.V[e-1]=Wc(J,N,null,z,C);return[]});return[]})},_embind_register_class_function:(d,e,l,q,z,C,D,F)=>{var J=Xc(l,q);e=Vb(e);e=Yc(e);C=Sc(z,C);qc([],[d],N=>{function R(){Uc(`Cannot call ${T} due to unbound types`,J)}N=N[0];var T=`${N.name}.${e}`;e.startsWith("@@")&&(e=Symbol[e.substring(2)]);F&&N.o.ob.push(e);var V=N.o.M,na=V[e];void 0===na||void 0===na.A&&na.className!==N.name&&na.R===l-2?(R.R=
l-2,R.className=N.name,V[e]=R):(wc(V,e,T),V[e].A[l-2]=R);qc([],J,qa=>{qa=Wc(T,qa,N,C,D);void 0===V[e].A?(qa.R=l-2,V[e]=qa):V[e].A[l-2]=qa;return[]});return[]})},_embind_register_class_property:(d,e,l,q,z,C,D,F,J,N)=>{e=Vb(e);z=Sc(q,z);qc([],[d],R=>{R=R[0];var T=`${R.name}.${e}`,V={get(){Uc(`Cannot access ${T} due to unbound types`,[l,D])},enumerable:!0,configurable:!0};V.set=J?()=>Uc(`Cannot access ${T} due to unbound types`,[l,D]):()=>{throw new Rb(T+" is a read-only property");};Object.defineProperty(R.o.M,
e,V);qc([],J?[l,D]:[l],na=>{var qa=na[0],U={get(){var fa=Zc(this,R,T+" getter");return qa.s(z(C,fa))},enumerable:!0};if(J){J=Sc(F,J);var ba=na[1];U.set=function(fa){var ea=Zc(this,R,T+" setter"),ka=[];J(N,ea,ba.B(ka,fa));kc(ka)}}Object.defineProperty(R.o.M,e,U);return[]});return[]})},_embind_register_emval:d=>pc(d,ad),_embind_register_enum:(d,e,l,q,z)=>{e=Vb(e);z=0===z?"object":1===z?"number":"string";switch(z){case "object":function D(){}D.values={};pc(d,{name:e,constructor:D,valueType:z,s:function(F){return this.constructor.values[F]},
B:(F,J)=>J.value,J:bd(e,l,q),H:null});xc(e,D);break;case "number":var C={};pc(d,{name:e,Ra:C,valueType:z,s:F=>F,B:(F,J)=>J,J:bd(e,l,q),H:null});xc(e,C);delete I[e].R;break;case "string":C={},pc(d,{name:e,xb:{},tb:{},Ra:C,valueType:z,s:function(F){return this.tb[F]},B:function(F,J){return this.xb[J]},J:bd(e,l,q),H:null}),xc(e,C),delete I[e].R}},_embind_register_enum_value:(d,e,l)=>{var q=fc(d,"enum");e=Vb(e);switch(q.valueType){case "object":d=q.constructor;q=Object.create(q.constructor.prototype,
{value:{value:l},constructor:{value:Ob(`${q.name}_${e}`,function(){})}});d.values[l]=q;d[e]=q;break;case "number":q.Ra[e]=l;break;case "string":q.xb[e]=l,q.tb[l]=e,q.Ra[e]=e}},_embind_register_float:(d,e,l)=>{e=Vb(e);pc(d,{name:e,s:q=>q,B:(q,z)=>z,J:cd(e,l),H:null})},_embind_register_function:(d,e,l,q,z,C)=>{var D=Xc(e,l);d=Vb(d);d=Yc(d);z=Sc(q,z);xc(d,function(){Uc(`Cannot call ${d} due to unbound types`,D)},e-1);qc([],D,F=>{Nc(d,Wc(d,[F[0],null].concat(F.slice(1)),null,z,C),e-1);return[]})},_embind_register_integer:(d,
e,l,q,z)=>{e=Vb(e);let C=F=>F;if(0===q){var D=32-8*l;C=F=>F<<D>>>D;z=C(z)}pc(d,{name:e,s:C,B:(F,J)=>J,J:dd(e,l,0!==q),H:null})},_embind_register_memory_view:(d,e,l)=>{function q(C){return new z(db.buffer,jb[C+4>>2],jb[C>>2])}var z=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array][e];l=Vb(l);pc(d,{name:l,s:q,J:q},{ic:!0})},_embind_register_std_string:(d,e)=>{e=Vb(e);pc(d,{name:e,s(l){var q=(q=l+4)?Nb(eb,q,jb[l>>2],!0):"";$b(l);return q},B(l,q){q instanceof
ArrayBuffer&&(q=new Uint8Array(q));var z="string"==typeof q;if(!(z||ArrayBuffer.isView(q)&&1==q.BYTES_PER_ELEMENT))throw new Rb("Cannot pass non-string to std::string");var C=z?fd(q):q.length;var D=de(4+C+1),F=D+4;jb[D>>2]=C;z?ed(q,F,C+1):eb.set(q,F);null!==l&&l.push($b,D);return D},J:lc,H(l){$b(l)}})},_embind_register_std_wstring:(d,e,l)=>{l=Vb(l);if(2===e){var q=hd;var z=jd;var C=kd}else q=ld,z=md,C=nd;pc(d,{name:l,s:D=>{var F=q(D+4,jb[D>>2]*e,!0);$b(D);return F},B:(D,F)=>{if("string"!=typeof F)throw new Rb(`Cannot pass non-string to C++ string type ${l}`);
var J=C(F),N=de(4+J+e);jb[N>>2]=J/e;z(F,N+4,J+e);null!==D&&D.push($b,N);return N},J:lc,H(D){$b(D)}})},_embind_register_value_object:(d,e,l,q,z,C)=>{jc[d]={name:Vb(e),Va:Sc(l,q),N:Sc(z,C),hb:[]}},_embind_register_value_object_field:(d,e,l,q,z,C,D,F,J,N)=>{jc[d].hb.push({Xb:Vb(e),dc:l,bc:Sc(q,z),cc:C,fj:D,ej:Sc(F,J),gj:N})},_embind_register_void:(d,e)=>{e=Vb(e);pc(d,{kc:!0,name:e,s:()=>{},B:()=>{}})},_emscripten_throw_longjmp:()=>{throw Infinity;},_emval_create_invoker:(d,e,l)=>{var [q,...z]=qd(d,e),
C=q.B.bind(q),D=z.map(J=>J.J.bind(J));d--;var F=Array(d);e=`methodCaller<(${z.map(J=>J.name)}) => ${q.name}>`;return pd(Ob(e,(J,N,R,T)=>{for(var V=0,na=0;na<d;++na)F[na]=D[na](T+V),V+=8;switch(l){case 0:var qa=Sb(J).apply(null,F);break;case 2:qa=Reflect.construct(Sb(J),F);break;case 3:qa=F[0];break;case 1:qa=Sb(J)[sd(N)](...F)}J=[];qa=C(J,qa);J.length&&(jb[R>>2]=Tb(J));return qa}))},_emval_decref:$c,_emval_get_property:(d,e)=>{d=Sb(d);e=Sb(e);return Tb(d[e])},_emval_incref:d=>{9<d&&(Qb[d+1]+=1)},
_emval_invoke:(d,e,l,q,z)=>od[d](e,l,q,z),_emval_new_array:()=>Tb([]),_emval_new_cstring:d=>Tb(sd(d)),_emval_new_object:()=>Tb({}),_emval_run_destructors:d=>{var e=Sb(d);kc(e);$c(d)},_emval_set_property:(d,e,l)=>{d=Sb(d);e=Sb(e);l=Sb(l);d[e]=l},_gmtime_js:function(d,e,l){d=new Date(1E3*(e+2097152>>>0<4194305-!!d?(d>>>0)+4294967296*e:NaN));L[l>>2]=d.getUTCSeconds();L[l+4>>2]=d.getUTCMinutes();L[l+8>>2]=d.getUTCHours();L[l+12>>2]=d.getUTCDate();L[l+16>>2]=d.getUTCMonth();L[l+20>>2]=d.getUTCFullYear()-
1900;L[l+24>>2]=d.getUTCDay();L[l+28>>2]=(d.getTime()-Date.UTC(d.getUTCFullYear(),0,1,0,0,0,0))/864E5|0},_localtime_js:function(d,e,l){d=new Date(1E3*(e+2097152>>>0<4194305-!!d?(d>>>0)+4294967296*e:NaN));L[l>>2]=d.getSeconds();L[l+4>>2]=d.getMinutes();L[l+8>>2]=d.getHours();L[l+12>>2]=d.getDate();L[l+16>>2]=d.getMonth();L[l+20>>2]=d.getFullYear()-1900;L[l+24>>2]=d.getDay();e=d.getFullYear();L[l+28>>2]=(0!==e%4||0===e%100&&0!==e%400?ud:td)[d.getMonth()]+d.getDate()-1|0;L[l+36>>2]=-(60*d.getTimezoneOffset());
e=(new Date(d.getFullYear(),6,1)).getTimezoneOffset();var q=(new Date(d.getFullYear(),0,1)).getTimezoneOffset();L[l+32>>2]=(e!=q&&d.getTimezoneOffset()==Math.min(q,e))|0},_timegm_js:function(d){var e=new Date(Date.UTC(L[d+20>>2]+1900,L[d+16>>2],L[d+12>>2],L[d+8>>2],L[d+4>>2],L[d>>2],0));L[d+24>>2]=e.getUTCDay();L[d+28>>2]=(e.getTime()-Date.UTC(e.getUTCFullYear(),0,1,0,0,0,0))/864E5|0;d=e.getTime()/1E3;ze((zb=d,1<=+Math.abs(zb)?0<zb?+Math.floor(zb/4294967296)>>>0:~~+Math.ceil((zb-+(~~zb>>>0))/4294967296)>>>
0:0));return d>>>0},_tzset_js:(d,e,l,q)=>{var z=(new Date).getFullYear(),C=(new Date(z,0,1)).getTimezoneOffset();z=(new Date(z,6,1)).getTimezoneOffset();jb[d>>2]=60*Math.max(C,z);L[e>>2]=Number(C!=z);e=D=>{var F=Math.abs(D);return`UTC${0<=D?"-":"+"}${String(Math.floor(F/60)).padStart(2,"0")}${String(F%60).padStart(2,"0")}`};d=e(C);e=e(z);z<C?(ed(d,l,17),ed(e,q,17)):(ed(d,q,17),ed(e,l,17))},beginPixelLocalStorageWEBGL:function(d,e,l){(d=Oa[d].F.Da)&&d.beginPixelLocalStorageWEBGL(new Uint32Array(rb.buffer,
4*l,e))},clock_time_get:function(d,e,l,q){if(!(0<=d&&3>=d))return 28;d=Math.round(1E6*(0===d?Date.now():performance.now()));Ab=[d>>>0,(zb=d,1<=+Math.abs(zb)?0<zb?+Math.floor(zb/4294967296)>>>0:~~+Math.ceil((zb-+(~~zb>>>0))/4294967296)>>>0:0)];L[q>>2]=Ab[0];L[q+4>>2]=Ab[1];return 0},decode_image:function(d,e,l){var q=I.images;q||(q=new Map,I.images=q);var z=new Image;q.set(d,z);e=I.HEAP8.subarray(e,e+l);l=new Uint8Array(l);l.set(e);z.src=URL.createObjectURL(new Blob([l],{type:"image/png"}));z.onload=
function(){I._setWebImage(d,z.width,z.height)}},delete_image:function(d){var e=I.images;e&&e.get(d)&&e.delete(d)},emscripten_asm_const_int:(d,e,l)=>{vd.length=0;for(var q;q=eb[e++];){var z=105!=q;z&=112!=q;l+=z&&l%8?4:0;vd.push(112==q?jb[l>>2]:105==q?L[l>>2]:lb[l>>3]);l+=z?8:4}return me[d](...vd)},emscripten_date_now:()=>Date.now(),emscripten_get_now:()=>performance.now(),emscripten_is_main_browser_thread:()=>!sa,emscripten_resize_heap:d=>{var e=eb.length;d>>>=0;if(2147483648<d)return!1;for(var l=
1;4>=l;l*=2){var q=e*(1+.2/l);q=Math.min(q,d+100663296);a:{q=(Math.min(2147483648,65536*Math.ceil(Math.max(d,q)/65536))-rb.buffer.byteLength+65535)/65536|0;try{rb.grow(q);qb();var z=1;break a}catch(C){}z=void 0}if(z)return!0}return!1},emscripten_webgl_enable_extension:(d,e)=>{d=Oa[d];e=e?Nb(eb,e):"";e.startsWith("GL_")&&(e=e.slice(3));"WEBGL_draw_instanced_base_vertex_base_instance"==e&&wd(Z);"WEBGL_multi_draw_instanced_base_vertex_base_instance"==e&&xd(Z);"WEBGL_multi_draw"==e&&(Z.oc=Z.getExtension("WEBGL_multi_draw"));
"EXT_polygon_offset_clamp"==e&&(Z.Vb=Z.getExtension("EXT_polygon_offset_clamp"));"EXT_clip_control"==e&&(Z.Ub=Z.getExtension("EXT_clip_control"));"WEBGL_polygon_mode"==e&&(Z.kj=Z.getExtension("WEBGL_polygon_mode"));return!!d.F.getExtension(e)},emscripten_webgl_get_current_context:()=>Na?Na.handle:0,emscripten_webgl_make_context_current:d=>La(d)?0:-5,enable_WEBGL_provoking_vertex:function(d){d=Oa[d].F;d.pb=d.getExtension("WEBGL_provoking_vertex");return!!d.pb},enable_WEBGL_shader_pixel_local_storage_coherent:function(d){d=
Oa[d].F;const e=d.getExtension("WEBGL_shader_pixel_local_storage");if(e&&e.isCoherent()){if(5==e.framebufferTexturePixelLocalStorageWEBGL.length)return d.Da=e,!0;console.warn("WEBGL_shader_pixel_local_storage is advertised, but a deprecated version has been detected. Disabling.")}return!1},endPixelLocalStorageWEBGL:function(d,e,l){(d=Oa[d].F.Da)&&d.endPixelLocalStorageWEBGL(new Uint32Array(rb.buffer,4*l,e))},environ_get:(d,e)=>{var l=0,q=0,z;for(z of Zd()){var C=e+l;jb[d+q>>2]=C;l+=ed(z,C,Infinity)+
1;q+=4}return 0},environ_sizes_get:(d,e)=>{var l=Zd();jb[d>>2]=l.length;d=0;for(var q of l)d+=fd(q)+1;jb[e>>2]=d;return 0},fd_close:()=>52,fd_read:()=>52,fd_seek:function(){return 70},fd_write:(d,e,l,q)=>{for(var z=0,C=0;C<l;C++){var D=jb[e>>2],F=jb[e+4>>2];e+=8;for(var J=0;J<F;J++){var N=d,R=eb[D+J],T=$d[N];0===R||10===R?((1===N?Ya:Za)(Nb(T)),T.length=0):T.push(R)}z+=F}jb[q>>2]=z;return 0},framebufferPixelLocalClearValuefvWEBGL:function(d,e,l,q,z,C){(d=Oa[d].F.Da)&&d.framebufferPixelLocalClearValuefvWEBGL(e,
[l,q,z,C])},framebufferTexturePixelLocalStorageWEBGL:function(d,e,l,q,z,C){(d=Oa[d].F.Da)&&d.framebufferTexturePixelLocalStorageWEBGL(e,Ed[l],q,z,C)},glActiveTexture:d=>Z.activeTexture(d),glAttachShader:(d,e)=>{Z.attachShader(Bd[d],Fd[e])},glBindAttribLocation:(d,e,l)=>{Z.bindAttribLocation(Bd[d],e,l?Nb(eb,l):"")},glBindBuffer:(d,e)=>{35051==d?Z.La=e:35052==d&&(Z.ba=e);Z.bindBuffer(d,Ad[e])},glBindBufferRange:(d,e,l,q,z)=>{Z.bindBufferRange(d,e,Ad[l],q,z)},glBindFramebuffer:(d,e)=>{Z.bindFramebuffer(d,
Cd[e])},glBindRenderbuffer:(d,e)=>{Z.bindRenderbuffer(d,Dd[e])},glBindSampler:(d,e)=>{Z.bindSampler(d,Hd[e])},glBindTexture:(d,e)=>{Z.bindTexture(d,Ed[e])},glBindVertexArray:d=>{Z.bindVertexArray(Gd[d])},glBlendColor:(d,e,l,q)=>Z.blendColor(d,e,l,q),glBlendEquation:d=>Z.blendEquation(d),glBlendEquationSeparate:(d,e)=>Z.blendEquationSeparate(d,e),glBlendFunc:(d,e)=>Z.blendFunc(d,e),glBlendFuncSeparate:(d,e,l,q)=>Z.blendFuncSeparate(d,e,l,q),glBlitFramebuffer:(d,e,l,q,z,C,D,F,J,N)=>Z.blitFramebuffer(d,
e,l,q,z,C,D,F,J,N),glBufferData:(d,e,l,q)=>{l&&e?Z.bufferData(d,eb,q,l,e):Z.bufferData(d,e,q)},glBufferSubData:(d,e,l,q)=>{l&&Z.bufferSubData(d,e,eb,q,l)},glCheckFramebufferStatus:d=>Z.checkFramebufferStatus(d),glClear:d=>Z.clear(d),glClearBufferfi:(d,e,l,q)=>Z.clearBufferfi(d,e,l,q),glClearBufferfv:(d,e,l)=>{Z.clearBufferfv(d,e,kb,l>>2)},glClearBufferiv:(d,e,l)=>{Z.clearBufferiv(d,e,L,l>>2)},glClearBufferuiv:(d,e,l)=>{Z.clearBufferuiv(d,e,jb,l>>2)},glClearColor:(d,e,l,q)=>Z.clearColor(d,e,l,q),glClearDepthf:d=>
Z.clearDepth(d),glClearStencil:d=>Z.clearStencil(d),glClientWaitSync:(d,e,l,q)=>Z.clientWaitSync(Id[d],e,(l>>>0)+4294967296*q),glColorMask:(d,e,l,q)=>{Z.colorMask(!!d,!!e,!!l,!!q)},glCompileShader:d=>{Z.compileShader(Fd[d])},glCompressedTexSubImage2D:(d,e,l,q,z,C,D,F,J)=>{Z.ba||!F?Z.compressedTexSubImage2D(d,e,l,q,z,C,D,F,J):Z.compressedTexSubImage2D(d,e,l,q,z,C,D,eb,J,F)},glCompressedTexSubImage3D:(d,e,l,q,z,C,D,F,J,N,R)=>{Z.ba?Z.compressedTexSubImage3D(d,e,l,q,z,C,D,F,J,N,R):Z.compressedTexSubImage3D(d,
e,l,q,z,C,D,F,J,eb,R,N)},glCreateProgram:()=>{var d=Ud(Bd),e=Z.createProgram();e.name=d;e.Ca=e.Aa=e.Ba=0;e.Za=1;Bd[d]=e;return d},glCreateShader:d=>{var e=Ud(Fd);Fd[e]=Z.createShader(d);return e},glCullFace:d=>Z.cullFace(d),glDeleteBuffers:(d,e)=>{for(var l=0;l<d;l++){var q=L[e+4*l>>2],z=Ad[q];z&&(Z.deleteBuffer(z),z.name=0,Ad[q]=null,q==Z.La&&(Z.La=0),q==Z.ba&&(Z.ba=0))}},glDeleteFramebuffers:(d,e)=>{for(var l=0;l<d;++l){var q=L[e+4*l>>2],z=Cd[q];z&&(Z.deleteFramebuffer(z),z.name=0,Cd[q]=null)}},
glDeleteProgram:d=>{if(d){var e=Bd[d];e?(Z.deleteProgram(e),e.name=0,Bd[d]=null):Vd||=1281}},glDeleteRenderbuffers:(d,e)=>{for(var l=0;l<d;l++){var q=L[e+4*l>>2],z=Dd[q];z&&(Z.deleteRenderbuffer(z),z.name=0,Dd[q]=null)}},glDeleteSamplers:(d,e)=>{for(var l=0;l<d;l++){var q=L[e+4*l>>2],z=Hd[q];z&&(Z.deleteSampler(z),z.name=0,Hd[q]=null)}},glDeleteShader:d=>{if(d){var e=Fd[d];e?(Z.deleteShader(e),Fd[d]=null):Vd||=1281}},glDeleteSync:d=>{if(d){var e=Id[d];e?(Z.deleteSync(e),e.name=0,Id[d]=null):Vd||=
1281}},glDeleteTextures:(d,e)=>{for(var l=0;l<d;l++){var q=L[e+4*l>>2],z=Ed[q];z&&(Z.deleteTexture(z),z.name=0,Ed[q]=null)}},glDeleteVertexArrays:(d,e)=>{for(var l=0;l<d;l++){var q=L[e+4*l>>2];Z.deleteVertexArray(Gd[q]);Gd[q]=null}},glDepthFunc:d=>Z.depthFunc(d),glDepthMask:d=>{Z.depthMask(!!d)},glDepthRangef:(d,e)=>Z.depthRange(d,e),glDisable:d=>Z.disable(d),glDisableVertexAttribArray:d=>{Z.disableVertexAttribArray(d)},glDrawArrays:(d,e,l)=>{Z.drawArrays(d,e,l)},glDrawArraysInstanced:(d,e,l,q)=>
{Z.drawArraysInstanced(d,e,l,q)},glDrawBuffers:(d,e)=>{for(var l=ae[d],q=0;q<d;q++)l[q]=L[e+4*q>>2];Z.drawBuffers(l)},glDrawElements:(d,e,l,q)=>{Z.drawElements(d,e,l,q)},glDrawElementsInstanced:(d,e,l,q,z)=>{Z.drawElementsInstanced(d,e,l,q,z)},glEnable:d=>Z.enable(d),glEnableVertexAttribArray:d=>{Z.enableVertexAttribArray(d)},glFenceSync:(d,e)=>(d=Z.fenceSync(d,e))?(e=Ud(Id),d.name=e,Id[e]=d,e):0,glFlush:()=>Z.flush(),glFramebufferRenderbuffer:(d,e,l,q)=>{Z.framebufferRenderbuffer(d,e,l,Dd[q])},glFramebufferTexture2D:(d,
e,l,q,z)=>{Z.framebufferTexture2D(d,e,l,Ed[q],z)},glFramebufferTextureLayer:(d,e,l,q,z)=>{Z.framebufferTextureLayer(d,e,Ed[l],q,z)},glFrontFace:d=>Z.frontFace(d),glGenBuffers:(d,e)=>{Wd(d,e,"createBuffer",Ad)},glGenFramebuffers:(d,e)=>{Wd(d,e,"createFramebuffer",Cd)},glGenRenderbuffers:(d,e)=>{Wd(d,e,"createRenderbuffer",Dd)},glGenSamplers:(d,e)=>{Wd(d,e,"createSampler",Hd)},glGenTextures:(d,e)=>{Wd(d,e,"createTexture",Ed)},glGenVertexArrays:(d,e)=>{Wd(d,e,"createVertexArray",Gd)},glGenerateMipmap:d=>
Z.generateMipmap(d),glGetFloatv:(d,e)=>ce(d,e,2),glGetFramebufferAttachmentParameteriv:(d,e,l,q)=>{d=Z.getFramebufferAttachmentParameter(d,e,l);if(d instanceof WebGLRenderbuffer||d instanceof WebGLTexture)d=d.name|0;L[q>>2]=d},glGetIntegerv:(d,e)=>ce(d,e,0),glGetProgramInfoLog:(d,e,l,q)=>{d=Z.getProgramInfoLog(Bd[d]);null===d&&(d="(unknown error)");e=0<e&&q?ed(d,q,e):0;l&&(L[l>>2]=e)},glGetProgramiv:(d,e,l)=>{if(l)if(d>=zd)Vd||=1281;else if(d=Bd[d],35716==e)d=Z.getProgramInfoLog(d),null===d&&(d="(unknown error)"),
L[l>>2]=d.length+1;else if(35719==e){if(!d.Ca){var q=Z.getProgramParameter(d,35718);for(e=0;e<q;++e)d.Ca=Math.max(d.Ca,Z.getActiveUniform(d,e).name.length+1)}L[l>>2]=d.Ca}else if(35722==e){if(!d.Aa)for(q=Z.getProgramParameter(d,35721),e=0;e<q;++e)d.Aa=Math.max(d.Aa,Z.getActiveAttrib(d,e).name.length+1);L[l>>2]=d.Aa}else if(35381==e){if(!d.Ba)for(q=Z.getProgramParameter(d,35382),e=0;e<q;++e)d.Ba=Math.max(d.Ba,Z.getActiveUniformBlockName(d,e).length+1);L[l>>2]=d.Ba}else L[l>>2]=Z.getProgramParameter(d,
e);else Vd||=1281},glGetShaderInfoLog:(d,e,l,q)=>{d=Z.getShaderInfoLog(Fd[d]);null===d&&(d="(unknown error)");e=0<e&&q?ed(d,q,e):0;l&&(L[l>>2]=e)},glGetShaderiv:(d,e,l)=>{l?35716==e?(d=Z.getShaderInfoLog(Fd[d]),null===d&&(d="(unknown error)"),L[l>>2]=d?d.length+1:0):35720==e?(d=Z.getShaderSource(Fd[d]),L[l>>2]=d?d.length+1:0):L[l>>2]=Z.getShaderParameter(Fd[d],e):Vd||=1281},glGetString:d=>{var e=Jd[d];if(!e){switch(d){case 7939:e=ee(be().join(" "));break;case 7936:case 7937:case 37445:case 37446:(e=
Z.getParameter(d))||(Vd||=1280);e=e?ee(e):0;break;case 7938:e=ee(`OpenGL ES 3.0 (${Z.getParameter(7938)})`);break;case 35724:e=Z.getParameter(35724);var l=e.match(/^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/);null!==l&&(3==l[1].length&&(l[1]+="0"),e=`OpenGL ES GLSL ES ${l[1]} (${e})`);e=ee(e);break;default:Vd||=1280}Jd[d]=e}return e},glGetStringi:(d,e)=>{if(2>Na.version)return Vd||=1282,0;var l=Kd[d];if(l)return 0>e||e>=l.length?(Vd||=1281,0):l[e];switch(d){case 7939:return l=be().map(ee),l=Kd[d]=
l,0>e||e>=l.length?(Vd||=1281,0):l[e];default:return Vd||=1280,0}},glGetUniformBlockIndex:(d,e)=>Z.getUniformBlockIndex(Bd[d],e?Nb(eb,e):""),glGetUniformLocation:(d,e)=>{e=e?Nb(eb,e):"";if(d=Bd[d]){var l=d,q=l.ma,z=l.wb,C;if(!q){l.ma=q={};l.vb={};var D=Z.getProgramParameter(l,35718);for(C=0;C<D;++C){var F=Z.getActiveUniform(l,C);var J=F.name;F=F.size;var N=fe(J);N=0<N?J.slice(0,N):J;var R=l.Za;l.Za+=F;z[N]=[F,R];for(J=0;J<F;++J)q[R]=J,l.vb[R++]=N}}l=d.ma;q=0;z=e;C=fe(e);0<C&&(q=parseInt(e.slice(C+
1))>>>0,z=e.slice(0,C));if((z=d.wb[z])&&q<z[0]&&(q+=z[1],l[q]=l[q]||Z.getUniformLocation(d,e)))return q}else Vd||=1281;return-1},glInvalidateFramebuffer:(d,e,l)=>{for(var q=ae[e],z=0;z<e;z++)q[z]=L[l+4*z>>2];Z.invalidateFramebuffer(d,q)},glLinkProgram:d=>{d=Bd[d];Z.linkProgram(d);d.ma=0;d.wb={}},glPixelStorei:(d,e)=>{3317==d?Sd=e:3314==d&&(Td=e);Z.pixelStorei(d,e)},glPolygonOffset:(d,e)=>Z.polygonOffset(d,e),glReadBuffer:d=>Z.readBuffer(d),glReadPixels:(d,e,l,q,z,C,D)=>{if(Z.La)Z.readPixels(d,e,l,
q,z,C,D);else{var F=ge(C);D>>>=31-Math.clz32(F.BYTES_PER_ELEMENT);Z.readPixels(d,e,l,q,z,C,F,D)}},glRenderbufferStorage:(d,e,l,q)=>Z.renderbufferStorage(d,e,l,q),glRenderbufferStorageMultisample:(d,e,l,q,z)=>Z.renderbufferStorageMultisample(d,e,l,q,z),glSamplerParameterf:(d,e,l)=>{Z.samplerParameterf(Hd[d],e,l)},glSamplerParameteri:(d,e,l)=>{Z.samplerParameteri(Hd[d],e,l)},glScissor:(d,e,l,q)=>Z.scissor(d,e,l,q),glShaderSource:(d,e,l,q)=>{for(var z="",C=0;C<e;++C){var D=(D=jb[l+4*C>>2])?Nb(eb,D,q?
jb[q+4*C>>2]:void 0):"";z+=D}Z.shaderSource(Fd[d],z)},glStencilFunc:(d,e,l)=>Z.stencilFunc(d,e,l),glStencilFuncSeparate:(d,e,l,q)=>Z.stencilFuncSeparate(d,e,l,q),glStencilMask:d=>Z.stencilMask(d),glStencilMaskSeparate:(d,e)=>Z.stencilMaskSeparate(d,e),glStencilOp:(d,e,l)=>Z.stencilOp(d,e,l),glStencilOpSeparate:(d,e,l,q)=>Z.stencilOpSeparate(d,e,l,q),glTexParameteri:(d,e,l)=>Z.texParameteri(d,e,l),glTexStorage2D:(d,e,l,q,z)=>Z.texStorage2D(d,e,l,q,z),glTexStorage3D:(d,e,l,q,z,C)=>Z.texStorage3D(d,
e,l,q,z,C),glTexSubImage2D:(d,e,l,q,z,C,D,F,J)=>{if(Z.ba)Z.texSubImage2D(d,e,l,q,z,C,D,F,J);else if(J){var N=ge(F);Z.texSubImage2D(d,e,l,q,z,C,D,F,N,J>>>31-Math.clz32(N.BYTES_PER_ELEMENT))}else{if(J){N=ge(F);var R=C*((Td||z)*({5:3,6:4,8:2,29502:3,29504:4,26917:2,26918:2,29846:3,29847:4}[D-6402]||1)*N.BYTES_PER_ELEMENT+Sd-1&-Sd);J=N.subarray(J>>>31-Math.clz32(N.BYTES_PER_ELEMENT),J+R>>>31-Math.clz32(N.BYTES_PER_ELEMENT))}else J=null;Z.texSubImage2D(d,e,l,q,z,C,D,F,J)}},glTexSubImage3D:(d,e,l,q,z,C,
D,F,J,N,R)=>{if(Z.ba)Z.texSubImage3D(d,e,l,q,z,C,D,F,J,N,R);else if(R){var T=ge(N);Z.texSubImage3D(d,e,l,q,z,C,D,F,J,N,T,R>>>31-Math.clz32(T.BYTES_PER_ELEMENT))}else Z.texSubImage3D(d,e,l,q,z,C,D,F,J,N,null)},glUniform1i:(d,e)=>{var l=Z,q=l.uniform1i;var z=Z.Qb;if(z){var C=z.ma[d];"number"==typeof C&&(z.ma[d]=C=Z.getUniformLocation(z,z.vb[d]+(0<C?`[${C}]`:"")));d=C}else Vd||=1282,d=void 0;q.call(l,d,e)},glUniformBlockBinding:(d,e,l)=>{d=Bd[d];Z.uniformBlockBinding(d,e,l)},glUseProgram:d=>{d=Bd[d];
Z.useProgram(d);Z.Qb=d},glVertexAttribDivisor:(d,e)=>{Z.vertexAttribDivisor(d,e)},glVertexAttribIPointer:(d,e,l,q,z)=>{Z.vertexAttribIPointer(d,e,l,q,z)},glVertexAttribPointer:(d,e,l,q,z,C)=>{Z.vertexAttribPointer(d,e,l,!!q,z,C)},glViewport:(d,e,l,q)=>Z.viewport(d,e,l,q),invoke_vii:Ae,isWindowsBrowser:function(){return-1<navigator.platform.indexOf("Win")},provokingVertexWEBGL:function(d,e){(d=Oa[d].F.pb)&&d.provokingVertexWEBGL(e)},riveWebAttach:function(){const d=I.riveScripting;if(!d)return 0;const e=
(l,q)=>{l=ee(l);q(l);$b(l)};d.Hb({exports:I,fc:l=>{l=jb[(ue()>>2)+l];return 0===l?void 0:Pc.get(l)},W:()=>eb,ib:()=>lb,la:Ib,Ea:ie,ka:Gb,Ta:de,ca:$b,oa:l=>l?Nb(eb,l):"",yb:(l,q,z)=>ed(l,q,z),memory:()=>rb,uc:(l,q,z)=>e(z,C=>I._rive_web_processor_event(l,q,C)),Sa:(l,q)=>e(q,z=>se(l,z)),lc:(l,q)=>e(q,z=>re(l,z)),mc:l=>{l=te(l);return 0===l?null:l?Nb(eb,l):""}});return 1},riveWebAudioRefusal:function(){const d=I.riveScripting.audioRefusal();return null===d?0:ee(d)},riveWebCall:function(d,e,l,q,z,C,D){return I.riveScripting.call(d,
e,l,q,z,C,D)},riveWebHasExport:function(d,e){return I.riveScripting.ec(d,e)},riveWebJobRun:function(d,e,l,q,z,C,D,F,J){d=I.riveScripting.runJob(d,e,()=>eb.slice(l,l+q),z,eb.slice(C,C+D),()=>Atomics.load(L,F>>2));if(!d.ok)return ee(d.error);J=qe(J,d.output.length);eb.set(d.output,J);return 0},riveWebMemoryPages:function(d){return I.riveScripting.rc(d)},riveWebPreparing:function(d){return I.riveScripting.Z(d)},riveWebRaise:function(d,e){I.riveScripting.vc(d,e)},riveWebReadMemory:function(d,e,l,q){return I.riveScripting.read(d,
e>>>0,l,q>>>0)},riveWebRegister:function(d,e,l){I.riveScripting.register(d,eb.subarray(e,e+l))},riveWebRelease:function(d){I.riveScripting?.release(d)},riveWebStart:function(d){d=I.riveScripting.start(d);return null===d?0:ee(d)},riveWebStringLength:function(d,e){return I.riveScripting.jj(d,e>>>0)},riveWebWorkerCollect:function(d){d=I.riveScripting.workerCollect(d);return null===d?0:ee(d)},riveWebWorkerEnd:function(d){I.riveScripting.workerEnd(d)},riveWebWorkerStart:function(d,e,l,q,z,C,D,F,J,N){let R=
!1;e=I.riveScripting.workerStart(e,l,()=>eb.slice(q,q+z),C,eb.slice(D,D+F),{wait:(T,V,na)=>ve(d,T,V,na),finished:(T,V)=>{if(!R){R=!0;if(T){const na=qe(J,V.length);eb.set(V,na)}we(d,T)}},ij:()=>xe(d)});if(!e.ok)return ee(e.error);jb[N>>2]=e.id;return 0},riveWebWorkerWake:function(d,e,l){d=I.riveScripting.workerWake(d,e,l);return null===d?0:ee(d)},riveWebWriteMemory:function(d,e,l,q){return I.riveScripting.write(d,e>>>0,l,q>>>0)},upload_image:function(d,e){var l=I.images;l&&(e=l.get(e))&&(d=Oa[d].F,
d.pixelStorei(d.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),d.texImage2D(d.TEXTURE_2D,0,d.RGBA,d.RGBA,d.UNSIGNED_BYTE,e),d.pixelStorei(d.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1))},wasm_start_image_decode:function(d,e,l){e=new Uint8Array(rb.buffer,e,l);var q=new Uint8Array(l);q.set(e);Promise.resolve().then(function(){return createImageBitmap(new Blob([q]))}).then(function(z){var C=(new OffscreenCanvas(z.width,z.height)).getContext("2d");C.drawImage(z,0,0);C=C.getImageData(0,0,z.width,z.height);var D=C.data.length,
F=ne(D);F?((new Uint8Array(rb.buffer,F,D)).set(C.data),oe(d,z.width,z.height,F,D)):pe(d)}).catch(function(){pe(d)})}};function Ae(d,e,l){var q=Hb();try{Pc.get(d)(e,l)}catch(z){Fb(q);if(z!==z+0)throw z;ye(1,0)}}var Ce;
Ce=await (async function(){function d(l){l=Ce=l.exports;$b=l.free;de=l.malloc;I._setWebImage=l.setWebImage;Zb=l.__getTypeName;ne=I._wasm_image_decode_alloc=l.wasm_image_decode_alloc;oe=I._wasm_image_decode_complete=l.wasm_image_decode_complete;pe=I._wasm_image_decode_error=l.wasm_image_decode_error;I._rive_web_vm_module_export=l.rive_web_vm_module_export;I._rive_web_vm_frame_boundary=l.rive_web_vm_frame_boundary;qe=I._rive_web_job_output=l.rive_web_job_output;re=I._rive_web_lane_fail=l.rive_web_lane_fail;
se=I._rive_web_lane_log=l.rive_web_lane_log;te=I._rive_web_lane_fuel=l.rive_web_lane_fuel;I._rive_web_vm_booting=l.rive_web_vm_booting;I._rive_web_vm_start_fuel=l.rive_web_vm_start_fuel;I._rive_web_vm_start_refusal=l.rive_web_vm_start_refusal;ue=I._rive_web_calls=l.rive_web_calls;ve=I._rive_web_worker_wait=l.rive_web_worker_wait;we=I._rive_web_worker_finished=l.rive_web_worker_finished;xe=I._rive_web_worker_stopping=l.rive_web_worker_stopping;je=I._ma_device__on_notification_unlocked=l.ma_device__on_notification_unlocked;
I._ma_malloc_emscripten=l.ma_malloc_emscripten;I._ma_free_emscripten=l.ma_free_emscripten;ke=I._ma_device_process_pcm_frames_capture__webaudio=l.ma_device_process_pcm_frames_capture__webaudio;le=I._ma_device_process_pcm_frames_playback__webaudio=l.ma_device_process_pcm_frames_playback__webaudio;ye=l.setThrew;ze=l._emscripten_tempret_set;Fb=l._emscripten_stack_restore;he=l._emscripten_stack_alloc;Hb=l.emscripten_stack_get_current;Oc.vij=l.dynCall_vij;Oc.iij=l.dynCall_iij;Oc.ji=l.dynCall_ji;Oc.iijii=
l.dynCall_iijii;Oc.iiiji=l.dynCall_iiiji;Oc.iiji=l.dynCall_iiji;Oc.jii=l.dynCall_jii;Oc.vijj=l.dynCall_vijj;Oc.jiji=l.dynCall_jiji;rb=l.memory;Pc=l.__indirect_function_table;qb();return Ce}var e={env:Be,wasi_snapshot_preview1:Be};if(I.instantiateWasm)return new Promise(l=>{I.instantiateWasm(e,(q,z)=>{l(d(q,z))})});tb??=I.locateFile?I.locateFile("webgl2_advanced.wasm",Qa):Qa+"webgl2_advanced.wasm";return d((await yb(e)).instance)}());
(function(){function d(){I.calledRun=!0;if(!ab){pb=!0;Ce.__wasm_call_ctors();bb?.(I);I.onRuntimeInitialized?.();if(I.postRun)for("function"==typeof I.postRun&&(I.postRun=[I.postRun]);I.postRun.length;){var e=I.postRun.shift();Cb.push(e)}Bb(Cb)}}if(I.preRun)for("function"==typeof I.preRun&&(I.preRun=[I.preRun]);I.preRun.length;)Eb();Bb(Db);I.setStatus?(I.setStatus("Running..."),setTimeout(()=>{setTimeout(()=>I.setStatus(""),1);d()},1)):d()})();pb?moduleRtn=I:moduleRtn=new Promise((d,e)=>{bb=d;cb=e});
;return moduleRtn}})();
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Rive);


/***/ }),
/* 5 */
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"name":"@rive-app/webgl2","version":"2.46.0","description":"Rive\'s webgl2 based web api.","main":"rive.js","homepage":"https://rive.app","repository":{"type":"git","url":"https://github.com/rive-app/rive-wasm/tree/master/js"},"keywords":["rive","animation"],"author":"Rive","contributors":["Luigi Rosso <luigi@rive.app> (https://rive.app)","Maxwell Talbot <max@rive.app> (https://rive.app)","Arthur Vivian <arthur@rive.app> (https://rive.app)","Umberto Sonnino <umberto@rive.app> (https://rive.app)","Matthew Sullivan <matt.j.sullivan@gmail.com> (mailto:matt.j.sullivan@gmail.com)","Chris Dalton <chris@rive.app> (https://rive.app)"],"license":"MIT","files":["rive.js","rive.wasm","rive_fallback.wasm","rive.js.map","rive.d.ts","rive_advanced.mjs.d.ts","runtimeLoader.d.ts","utils","semantics"],"typings":"rive.d.ts","dependencies":{},"browser":{"fs":false,"path":false}}');

/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AccessibilityOverlay: () => (/* reexport safe */ _accessibilityOverlay__WEBPACK_IMPORTED_MODULE_1__.AccessibilityOverlay),
/* harmony export */   CHECK_STATE_MASK: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.CHECK_STATE_MASK),
/* harmony export */   CHECK_STATE_OFFSET: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.CHECK_STATE_OFFSET),
/* harmony export */   SemanticActionType: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.SemanticActionType),
/* harmony export */   SemanticCheckState: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.SemanticCheckState),
/* harmony export */   SemanticMode: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.SemanticMode),
/* harmony export */   SemanticRole: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole),
/* harmony export */   SemanticState: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState),
/* harmony export */   SemanticTrait: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.SemanticTrait),
/* harmony export */   SemanticTreeModel: () => (/* reexport safe */ _semanticTreeModel__WEBPACK_IMPORTED_MODULE_0__.SemanticTreeModel),
/* harmony export */   checkStateOf: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.checkStateOf),
/* harmony export */   hasState: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.hasState),
/* harmony export */   hasTrait: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.hasTrait),
/* harmony export */   roleName: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.roleName),
/* harmony export */   stateNames: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.stateNames),
/* harmony export */   traitNames: () => (/* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_2__.traitNames)
/* harmony export */ });
/* harmony import */ var _semanticTreeModel__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(7);
/* harmony import */ var _accessibilityOverlay__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9);
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8);





/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SemanticTreeModel: () => (/* binding */ SemanticTreeModel)
/* harmony export */ });
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(8);
var __spreadArray = (undefined && undefined.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};

/**
 * Maintains an in-memory semantic tree built from incremental
 * {@link SemanticsDiff} updates received each frame from the WASM runtime.
 *
 * Processing order within {@link applyDiff} follows the contract defined in
 * `semantic_snapshot.hpp`: removed → added → moved → childrenUpdated →
 * updatedSemantic → updatedGeometry.
 */
var SemanticTreeModel = /** @class */ (function () {
    function SemanticTreeModel() {
        this._nodesById = new Map();
        this._roots = [];
        this._semanticVersion = 0;
        this._geometryVersion = 0;
        this._geometryChangedIds = new Set();
        this._semanticChangedIds = new Set();
        this._debug = false;
    }
    Object.defineProperty(SemanticTreeModel.prototype, "nodeCount", {
        get: function () {
            return this._nodesById.size;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SemanticTreeModel.prototype, "semanticVersion", {
        /** Bumped when semantic content or tree structure changes. */
        get: function () {
            return this._semanticVersion;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SemanticTreeModel.prototype, "geometryVersion", {
        /** Bumped when node bounds change without a semantic/structural change. */
        get: function () {
            return this._geometryVersion;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SemanticTreeModel.prototype, "geometryChangedIds", {
        /** Node IDs whose bounds changed in the most recent {@link applyDiff}. */
        get: function () {
            return this._geometryChangedIds;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SemanticTreeModel.prototype, "semanticChangedIds", {
        /**
         * Node IDs whose semantic fields (role/label/value/hint/flags/headingLevel)
         * changed in the most recent {@link applyDiff}. Structural changes (moves,
         * child reorders, removals) bump {@link semanticVersion} but don't mark
         * nodes here — element attributes don't depend on tree position.
         */
        get: function () {
            return this._semanticChangedIds;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SemanticTreeModel.prototype, "roots", {
        /** Root node IDs in sibling order. */
        get: function () {
            return this._roots;
        },
        enumerable: false,
        configurable: true
    });
    /** Look up a node by its ID, or undefined if not in the tree. */
    SemanticTreeModel.prototype.nodeById = function (id) {
        return this._nodesById.get(id);
    };
    /** The node with SemanticState.Focused, or undefined. */
    SemanticTreeModel.prototype.focusedNode = function () {
        // Manual iteration: runs every frame and must stop at the first hit (the
        // TS target forbids for-of over Map iterators).
        var it = this._nodesById.values();
        for (var r = it.next(); !r.done; r = it.next()) {
            if ((0,_types__WEBPACK_IMPORTED_MODULE_0__.hasState)(r.value.stateFlags, _types__WEBPACK_IMPORTED_MODULE_0__.SemanticState.Focused))
                return r.value;
        }
        return;
    };
    /** Current index of a node among its siblings (or roots), or -1 if absent. */
    SemanticTreeModel.prototype.siblingIndexOf = function (id) {
        var node = this._nodesById.get(id);
        if (!node)
            return -1;
        if (node.parentId < 0)
            return this._roots.indexOf(id);
        var parent = this._nodesById.get(node.parentId);
        return parent ? parent.children.indexOf(id) : -1;
    };
    /** Detach a node from its current parent (or from roots). */
    SemanticTreeModel.prototype.detach = function (id) {
        var node = this._nodesById.get(id);
        if (!node)
            return;
        if (node.parentId < 0) {
            var idx = this._roots.indexOf(id);
            if (idx !== -1)
                this._roots.splice(idx, 1);
        }
        else {
            var parent_1 = this._nodesById.get(node.parentId);
            if (parent_1) {
                var idx = parent_1.children.indexOf(id);
                if (idx !== -1)
                    parent_1.children.splice(idx, 1);
            }
        }
    };
    /** Attach a node under a parent at a given sibling index (or as root). */
    SemanticTreeModel.prototype.attach = function (id, parentId, siblingIndex) {
        var node = this._nodesById.get(id);
        if (!node)
            return;
        if (parentId < 0) {
            node.parentId = -1;
            var idx = clamp(siblingIndex, 0, this._roots.length);
            this._roots.splice(idx, 0, id);
        }
        else {
            var parent_2 = this._nodesById.get(parentId);
            if (!parent_2) {
                node.parentId = -1;
                this._roots.push(id);
            }
            else {
                node.parentId = parentId;
                var idx = clamp(siblingIndex, 0, parent_2.children.length);
                parent_2.children.splice(idx, 0, id);
            }
        }
    };
    /** Recursively remove a node and all descendants. */
    SemanticTreeModel.prototype.removeSubtree = function (id) {
        var node = this._nodesById.get(id);
        if (!node)
            return;
        // Copy children array — we're mutating during traversal
        var kids = __spreadArray([], node.children, true);
        for (var _i = 0, kids_1 = kids; _i < kids_1.length; _i++) {
            var child = kids_1[_i];
            this.removeSubtree(child);
        }
        this.detach(id);
        this._nodesById.delete(id);
    };
    /**
     * Apply an incremental diff to the tree. Bumps version counters and notifies
     * listeners only when the tree actually changed.
     *
     * No-op diffs (field values identical to current model) do not bump
     * versions — the native side guards against emitting these, but applyDiff
     * defends its subscribers regardless.
     */
    SemanticTreeModel.prototype.applyDiff = function (diff) {
        var _a, _b;
        var _this = this;
        this._geometryChangedIds.clear();
        this._semanticChangedIds.clear();
        var semanticChanged = false;
        var geometryChanged = false;
        var markSemantic = function () {
            semanticChanged = true;
        };
        var markSemanticNode = function (id) {
            semanticChanged = true;
            _this._semanticChangedIds.add(id);
        };
        var markGeometry = function (id) {
            geometryChanged = true;
            _this._geometryChangedIds.add(id);
        };
        // 1. removed
        for (var _i = 0, _c = diff.removed; _i < _c.length; _i++) {
            var id = _c[_i];
            if (this._nodesById.has(id)) {
                this.removeSubtree(id);
                markSemantic();
            }
        }
        // 2. added
        for (var _d = 0, _e = diff.added; _d < _e.length; _d++) {
            var n = _e[_d];
            var existing = this._nodesById.get(n.id);
            if (existing) {
                if (semanticFieldsDiffer(existing, n)) {
                    applySemantic(existing, n);
                    markSemanticNode(n.id);
                }
                if (geometryFieldsDiffer(existing, n)) {
                    applyGeometry(existing, n);
                    markGeometry(n.id);
                }
            }
            else {
                this._nodesById.set(n.id, nodeFromDiff(n));
                markSemanticNode(n.id);
                markGeometry(n.id);
            }
            this.detach(n.id);
            this.attach(n.id, n.parentId, n.siblingIndex);
        }
        // 3. moved
        // The runtime emits a node as "moved" when its parentId OR siblingIndex
        // changes, so a reorder-only move (same parent, new index) is still a
        // structural/semantic change. Compare the actual position before and after
        // re-attaching so that geometry-only or no-op moves don't bump the semantic
        // version (which would defeat the semantic/geometry version split).
        for (var _f = 0, _g = diff.moved; _f < _g.length; _f++) {
            var n = _g[_f];
            var existing = this._nodesById.get(n.id);
            if (!existing)
                continue;
            var parentChanged = existing.parentId !== n.parentId;
            var oldIndex = this.siblingIndexOf(n.id);
            var geomChanged = geometryFieldsDiffer(existing, n);
            if (geomChanged) {
                applyGeometry(existing, n);
                markGeometry(n.id);
            }
            this.detach(n.id);
            this.attach(n.id, n.parentId, n.siblingIndex);
            if (parentChanged || this.siblingIndexOf(n.id) !== oldIndex) {
                markSemantic();
            }
        }
        // 4. childrenUpdated
        for (var _h = 0, _j = diff.childrenUpdated; _h < _j.length; _h++) {
            var update = _j[_h];
            if (update.parentId < 0) {
                var next = update.childIds.filter(function (id) { return _this._nodesById.has(id); });
                if (!arraysEqual(this._roots, next)) {
                    this._roots.length = 0;
                    (_a = this._roots).push.apply(_a, next);
                    for (var _k = 0, _l = this._roots; _k < _l.length; _k++) {
                        var id = _l[_k];
                        var node = this._nodesById.get(id);
                        if (node)
                            node.parentId = -1;
                    }
                    markSemantic();
                }
            }
            else {
                var parent_3 = this._nodesById.get(update.parentId);
                if (!parent_3)
                    continue;
                var next = update.childIds.filter(function (id) { return _this._nodesById.has(id); });
                if (!arraysEqual(parent_3.children, next)) {
                    parent_3.children.length = 0;
                    (_b = parent_3.children).push.apply(_b, next);
                    for (var _m = 0, _o = parent_3.children; _m < _o.length; _m++) {
                        var id = _o[_m];
                        var node = this._nodesById.get(id);
                        if (node)
                            node.parentId = update.parentId;
                    }
                    markSemantic();
                }
            }
        }
        // 5. updatedSemantic — semantic fields updated
        for (var _p = 0, _q = diff.updatedSemantic; _p < _q.length; _p++) {
            var n = _q[_p];
            var existing = this._nodesById.get(n.id);
            if (!existing)
                continue;
            if (!semanticFieldsDiffer(existing, n))
                continue;
            applySemantic(existing, n);
            markSemanticNode(n.id);
        }
        // 6. updatedGeometry — bounds of a semantic node updated
        for (var _r = 0, _s = diff.updatedGeometry; _r < _s.length; _r++) {
            var n = _s[_r];
            var existing = this._nodesById.get(n.id);
            if (!existing)
                continue;
            if (!geometryFieldsDiffer(existing, n))
                continue;
            applyGeometry(existing, n);
            markGeometry(n.id);
        }
        if (!semanticChanged && !geometryChanged)
            return;
        if (semanticChanged)
            this._semanticVersion++;
        if (geometryChanged)
            this._geometryVersion++;
        if (this._debug) {
            this.logDiff(diff, semanticChanged, geometryChanged);
        }
    };
    Object.defineProperty(SemanticTreeModel.prototype, "debug", {
        /** Enable/disable debug logging of diffs to the console. */
        set: function (enabled) {
            this._debug = enabled;
        },
        enumerable: false,
        configurable: true
    });
    SemanticTreeModel.prototype.logDiff = function (diff, semanticChanged, geometryChanged) {
        var lines = [
            "[rive:semantics] semantic v".concat(this._semanticVersion) +
                (geometryChanged ? " geometry v".concat(this._geometryVersion) : "") +
                (semanticChanged ? "" : " (geometry-only)"),
        ];
        for (var _i = 0, _a = diff.removed; _i < _a.length; _i++) {
            var id = _a[_i];
            lines.push("  - removed #".concat(id));
        }
        for (var _b = 0, _c = diff.added; _b < _c.length; _b++) {
            var n = _c[_b];
            lines.push("  + added #".concat(n.id, " ").concat((0,_types__WEBPACK_IMPORTED_MODULE_0__.roleName)(n.role)) +
                (n.label ? " \"".concat(n.label, "\"") : "") +
                " bounds:(".concat(n.minX.toFixed(1), ",").concat(n.minY.toFixed(1), ")-(").concat(n.maxX.toFixed(1), ",").concat(n.maxY.toFixed(1), ")") +
                " states=[".concat((0,_types__WEBPACK_IMPORTED_MODULE_0__.stateNames)(n.stateFlags), "]") +
                " traits=[".concat((0,_types__WEBPACK_IMPORTED_MODULE_0__.traitNames)(n.traitFlags), "]"));
        }
        for (var _d = 0, _e = diff.moved; _d < _e.length; _d++) {
            var n = _e[_d];
            lines.push("  ~ moved #".concat(n.id, " \u2192 parent=").concat(n.parentId, " idx=").concat(n.siblingIndex) +
                " bounds:(".concat(n.minX.toFixed(1), ",").concat(n.minY.toFixed(1), ")-(").concat(n.maxX.toFixed(1), ",").concat(n.maxY.toFixed(1), ")"));
        }
        for (var _f = 0, _g = diff.childrenUpdated; _f < _g.length; _f++) {
            var u = _g[_f];
            lines.push("  \u2195 children of ".concat(u.parentId < 0 ? "root" : "#" + u.parentId, ": [").concat(u.childIds.join(", "), "]"));
        }
        for (var _h = 0, _j = diff.updatedSemantic; _h < _j.length; _h++) {
            var n = _j[_h];
            lines.push("  \u270E semantic #".concat(n.id, " ").concat((0,_types__WEBPACK_IMPORTED_MODULE_0__.roleName)(n.role)) +
                (n.label ? " \"".concat(n.label, "\"") : "") +
                " states=[".concat((0,_types__WEBPACK_IMPORTED_MODULE_0__.stateNames)(n.stateFlags), "]") +
                " traits=[".concat((0,_types__WEBPACK_IMPORTED_MODULE_0__.traitNames)(n.traitFlags), "]"));
        }
        for (var _k = 0, _l = diff.updatedGeometry; _k < _l.length; _k++) {
            var n = _l[_k];
            lines.push("  \u229E geometry #".concat(n.id, " (").concat(n.minX.toFixed(1), ",").concat(n.minY.toFixed(1), ")-(").concat(n.maxX.toFixed(1), ",").concat(n.maxY.toFixed(1), ")"));
        }
        console.log(lines.join("\n"));
    };
    /**
     * Returns every node in depth-first order, paired with its depth level.
     * Useful for debug logging / rendering a flat list.
     */
    SemanticTreeModel.prototype.flattened = function () {
        var _this = this;
        var out = [];
        var walk = function (id, depth) {
            var node = _this._nodesById.get(id);
            if (!node)
                return;
            out.push({ depth: depth, node: node });
            for (var _i = 0, _a = node.children; _i < _a.length; _i++) {
                var child = _a[_i];
                walk(child, depth + 1);
            }
        };
        for (var _i = 0, _a = this._roots; _i < _a.length; _i++) {
            var root = _a[_i];
            walk(root, 0);
        }
        return out;
    };
    return SemanticTreeModel;
}());

function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
}
function arraysEqual(a, b) {
    if (a.length !== b.length)
        return false;
    for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
function nodeFromDiff(n) {
    return {
        id: n.id,
        parentId: -1,
        role: n.role,
        label: n.label,
        value: n.value,
        hint: n.hint,
        stateFlags: n.stateFlags,
        traitFlags: n.traitFlags,
        headingLevel: n.headingLevel,
        minX: n.minX,
        minY: n.minY,
        maxX: n.maxX,
        maxY: n.maxY,
        children: [],
    };
}
/** Compare role/label/value/hint/stateFlags/traitFlags/headingLevel. */
function semanticFieldsDiffer(a, b) {
    return (a.role !== b.role ||
        a.label !== b.label ||
        a.value !== b.value ||
        a.hint !== b.hint ||
        a.stateFlags !== b.stateFlags ||
        a.traitFlags !== b.traitFlags ||
        a.headingLevel !== b.headingLevel);
}
/** Compare only bounds (minX/minY/maxX/maxY). */
function geometryFieldsDiffer(a, b) {
    return (a.minX !== b.minX ||
        a.minY !== b.minY ||
        a.maxX !== b.maxX ||
        a.maxY !== b.maxY);
}
function applySemantic(target, src) {
    target.role = src.role;
    target.label = src.label;
    target.value = src.value;
    target.hint = src.hint;
    target.stateFlags = src.stateFlags;
    target.traitFlags = src.traitFlags;
    target.headingLevel = src.headingLevel;
}
function applyGeometry(target, src) {
    target.minX = src.minX;
    target.minY = src.minY;
    target.maxX = src.maxX;
    target.maxY = src.maxY;
}


/***/ }),
/* 8 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CHECK_STATE_MASK: () => (/* binding */ CHECK_STATE_MASK),
/* harmony export */   CHECK_STATE_OFFSET: () => (/* binding */ CHECK_STATE_OFFSET),
/* harmony export */   SemanticActionType: () => (/* binding */ SemanticActionType),
/* harmony export */   SemanticCheckState: () => (/* binding */ SemanticCheckState),
/* harmony export */   SemanticMode: () => (/* binding */ SemanticMode),
/* harmony export */   SemanticRole: () => (/* binding */ SemanticRole),
/* harmony export */   SemanticState: () => (/* binding */ SemanticState),
/* harmony export */   SemanticTrait: () => (/* binding */ SemanticTrait),
/* harmony export */   checkStateOf: () => (/* binding */ checkStateOf),
/* harmony export */   hasState: () => (/* binding */ hasState),
/* harmony export */   hasTrait: () => (/* binding */ hasTrait),
/* harmony export */   roleName: () => (/* binding */ roleName),
/* harmony export */   stateNames: () => (/* binding */ stateNames),
/* harmony export */   traitNames: () => (/* binding */ traitNames)
/* harmony export */ });
// ---------------------------------------------------------------------------
// SemanticRole — mirrors rive::SemanticRole
// ---------------------------------------------------------------------------
var SemanticRole = {
    none: 0,
    button: 1,
    link: 2,
    checkbox: 3,
    switchControl: 4,
    slider: 5,
    textField: 6,
    text: 7,
    image: 8,
    group: 9,
    list: 10,
    listItem: 11,
    tab: 12,
    tabList: 13,
    dialog: 14,
    alertDialog: 15,
    radioGroup: 16,
    radioButton: 17,
};
// ---------------------------------------------------------------------------
// SemanticState — mirrors rive::SemanticState bitmask
//
// Bits 0-7 are trait-gated (only meaningful when the corresponding
// SemanticTrait is set). Bits 8-13 are non-trait states.
//
// Check state is the exception: it is a two-bit *field* at bits 2-3 rather
// than a flag, because a checkbox is tri-state. It is not a member of this
// table — read it with checkStateOf().
// ---------------------------------------------------------------------------
var SemanticState = {
    None: 0,
    // Trait-gated
    Expanded: 1 << 0, // requires Expandable
    Selected: 1 << 1, // requires Selectable
    // Bits 2-3 are the check state field, not independent flags -- see SemanticCheckState.
    Toggled: 1 << 4, // requires Toggleable
    Required: 1 << 5, // requires Requirable
    Disabled: 1 << 6, // requires Enablable
    Focused: 1 << 7, // requires Focusable
    // Non-trait
    Hidden: 1 << 8,
    LiveRegion: 1 << 9,
    ReadOnly: 1 << 10,
    Modal: 1 << 11,
    Obscured: 1 << 12,
    Multiline: 1 << 13,
};
function hasState(flags, state) {
    return (flags & state) !== 0;
}
// SemanticCheckState — mirrors rive::SemanticCheckState
//
// The tri-state of a checkable node. Occupies two bits of stateFlags at
// CHECK_STATE_OFFSET, so it is read as a value rather than tested as a flag.
// Only meaningful when the Checkable trait is set.
var SemanticCheckState = {
    Unchecked: 0,
    Checked: 1,
    Mixed: 2,
};
/** Bit offset of the check field within stateFlags. */
var CHECK_STATE_OFFSET = 2;
/** Mask of the check field within stateFlags. */
var CHECK_STATE_MASK = 3 << CHECK_STATE_OFFSET;
/**
 * Decodes the check field out of `flags`. The field is two bits. Returns 0, 1, or 2
 * per the mapping in SemanticCheckState.
 */
function checkStateOf(flags) {
    var value = (flags & CHECK_STATE_MASK) >> CHECK_STATE_OFFSET;
    return value >= SemanticCheckState.Mixed
        ? SemanticCheckState.Mixed
        : value;
}
/**
 * Controls when the instance builds semantic trees and accessibility overlays.
 *
 * - `disabled`: no semantics work.
 * - `enabled`: semantics and overlay are active immediately after load.
 */
var SemanticMode = {
    Disabled: "disabled",
    Enabled: "enabled",
};
// ---------------------------------------------------------------------------
// SemanticTrait — mirrors rive::SemanticTrait bitmask
//
// Traits declare what *capabilities* a node has. A state flag is only
// meaningful when its corresponding trait is set.
// ---------------------------------------------------------------------------
var SemanticTrait = {
    None: 0,
    Expandable: 1 << 0,
    Selectable: 1 << 1,
    Checkable: 1 << 2,
    Toggleable: 1 << 3,
    Requirable: 1 << 4,
    Enablable: 1 << 5,
    Focusable: 1 << 6,
};
function hasTrait(flags, trait) {
    return (flags & trait) !== 0;
}
// ---------------------------------------------------------------------------
// SemanticActionType — mirrors rive::SemanticActionType
// ---------------------------------------------------------------------------
var SemanticActionType = {
    tap: 0,
    increase: 1,
    decrease: 2,
};
// ---------------------------------------------------------------------------
// Helpers — readable names for bitmask flags
// ---------------------------------------------------------------------------
var _roleNames = {};
for (var _i = 0, _a = Object.entries(SemanticRole); _i < _a.length; _i++) {
    var _b = _a[_i], name_1 = _b[0], val = _b[1];
    _roleNames[val] = name_1;
}
var _stateEntries = Object.entries(SemanticState).filter(function (_a) {
    var v = _a[1];
    return v !== 0;
});
var _traitEntries = Object.entries(SemanticTrait).filter(function (_a) {
    var v = _a[1];
    return v !== 0;
});
function roleName(role) {
    var _a;
    return (_a = _roleNames[role]) !== null && _a !== void 0 ? _a : "unknown(".concat(role, ")");
}
function stateNames(flags) {
    if (flags === 0)
        return "none";
    var active = [];
    for (var _i = 0, _stateEntries_1 = _stateEntries; _i < _stateEntries_1.length; _i++) {
        var _a = _stateEntries_1[_i], name_2 = _a[0], bit = _a[1];
        if (flags & bit)
            active.push(name_2);
    }
    switch (checkStateOf(flags)) {
        case SemanticCheckState.Checked:
            active.push("Checked");
            break;
        case SemanticCheckState.Mixed:
            active.push("Mixed");
            break;
    }
    return active.join(", ") || "none";
}
function traitNames(flags) {
    if (flags === 0)
        return "none";
    var active = [];
    for (var _i = 0, _traitEntries_1 = _traitEntries; _i < _traitEntries_1.length; _i++) {
        var _a = _traitEntries_1[_i], name_3 = _a[0], bit = _a[1];
        if (flags & bit)
            active.push(name_3);
    }
    return active.join(", ") || "none";
}


/***/ }),
/* 9 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AccessibilityOverlay: () => (/* binding */ AccessibilityOverlay)
/* harmony export */ });
/* harmony import */ var _claimedKeyEvents__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(10);
/* harmony import */ var _utils_canvasOffset__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(11);
/* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8);



var warnedUnpositionedWrapper = false;
/**
 * Warns once per page when no positioned element sits at or inside the canvas's
 * nearest scroll container: the overlay then can't scroll with the canvas. Reads only.
 */
function warnIfWrapperUnpositioned(canvas) {
    if (warnedUnpositionedWrapper)
        return;
    // Null when detached (or display:none / fixed); nothing to judge yet.
    var offsetParent = canvas.offsetParent;
    if (!offsetParent)
        return;
    var scrolls = function (v) { return v === "auto" || v === "scroll" || v === "overlay"; };
    var scroller = null;
    var el = canvas.parentElement;
    // Bounds pathological nesting.
    var MAX_ANCESTOR_WALK = 32;
    for (var i = 0; el && el !== document.documentElement && i < MAX_ANCESTOR_WALK; i++, el = el.parentElement) {
        var style = getComputedStyle(el);
        if (scrolls(style.overflowX) || scrolls(style.overflowY)) {
            scroller = el;
            break;
        }
    }
    // Only the viewport scrolls: any offsetParent scrolls with the page.
    if (!scroller || scroller.contains(offsetParent))
        return;
    warnedUnpositionedWrapper = true;
    console.warn('[Rive] Semantics: give the element wrapping the <canvas> "position: relative" (or another positioned value) so the semantic overlay scrolls with the canvas. Without it, screen readers may scroll to stale positions when the canvas is inside a scrolling container.');
}
/**
 * Creates and manages an invisible DOM tree overlaying a Rive canvas. This is for
 * screen readers to discover and interact with the Rive content.
 *
 * Each semantic node in the {@link SemanticTreeModel} gets a corresponding
 * DOM element with appropriate ARIA role, states, and action handlers so
 * assistive technologies (i.e. screen readers) can discover
 * and interact with the Rive content.
 *
 * Each node receives a prefixed ID (`id=rive-{instanceId}-sem-{nodeId}`) to avoid host-page ID collisions.
 * The nodeID is Rive's semantic node ID from core runtime.
 * Each node is styled with `pointer-events: none`. Interactive nodes can receive
 * programmatic focus and keydown events without entering the browser Tab order.
 */
var AccessibilityOverlay = /** @class */ (function () {
    function AccessibilityOverlay(options) {
        var _this = this;
        var _a, _b;
        this.elements = new Map();
        /** Visually-hidden description spans keyed by node ID, referenced by aria-describedby. */
        this.descElements = new Map();
        this.lastSemanticVersion = -1;
        this.lastGeometryVersion = -1;
        /** Text elements whose fit-scale needs recomputing, batched per update (see flushTextGeometry). */
        this.pendingTextGeometry = [];
        /** Last measured box-size|text key per text element, to skip redundant re-measures. */
        this.textGeometryKeys = new WeakMap();
        /** Node data last passed to applyAttributes per element; see {@link setEditingHostNode}. */
        this.appliedNodes = new WeakMap();
        this.lastCanvasPositioning = {
            width: -1, height: -1, offsetTop: -1, offsetLeft: -1,
        };
        /**
         * Set when a ResizeObserver/window-resize signals the canvas geometry may have
         * changed, cleared once the transform is re-synced. Lets {@link needsUpdate}
         * report geometry changes without a per-frame `getBoundingClientRect()` reflow.
         * Starts true so the first update computes the transform.
         */
        this._geometryDirty = true;
        /** True while reconciling the DOM (reserved for future focus-sync guards). */
        this.isUpdating = false;
        /** Node whose element the editing host stands in for, or null. */
        this.editingHostNodeId = null;
        /** Semantic version last folded into the editing host's decoration. */
        this.editingHostSemanticVersion = -1;
        /**
         * Single child div of the overlay container that carries the artboard→CSS
         * transform. All semantic node elements are children of this div and express
         * their positions in raw artboard-space coordinates. The CSS transform on
         * this container maps artboard units to CSS pixels in one GPU pass — no
         * per-node matrix multiplication required.
         */
        this.transformContainer = null;
        this._artboardBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        this.repositionTimer = null;
        this.canvasResizeObserver = null;
        this.parentResizeObserver = null;
        /**
         * Detects canvas *position* drift. See {@link observePosition}.
         */
        this.positionObserver = null;
        this._onWindowResize = function () { return _this.scheduleReposition(); };
        this.instanceId = options.instanceId;
        this.fireAction = options.fireAction;
        this.requestFocus = options.requestFocus;
        this.clearFocus = options.clearFocus;
        this.canvas = options.canvas;
        this.semanticsOptions = options.semanticsOptions;
        this.allowFocusInterrupt = (_a = options.allowFocusInterrupt) !== null && _a !== void 0 ? _a : false;
        this.isEditingHostFocused = (_b = options.isEditingHostFocused) !== null && _b !== void 0 ? _b : (function () { return false; });
        this.container = this.createContainer(options.canvas);
        this.attachPositionObservers();
        warnIfWrapperUnpositioned(options.canvas);
    }
    /**
     * Hide the stood-in node's element (no duplicate textbox for AT); re-derive the previous
     * one's aria-hidden.
     */
    AccessibilityOverlay.prototype.setEditingHostNode = function (nodeId) {
        if (this.editingHostNodeId === nodeId)
            return;
        var previous = this.editingHostNodeId;
        this.editingHostNodeId = nodeId;
        if (previous !== null) {
            var previousEl = this.elements.get(previous);
            // Re-derive rather than un-hide: the node may have become Hidden mid-session.
            if (previousEl) {
                var previousNode = this.appliedNodes.get(previousEl);
                if (previousNode && this.isAriaHidden(previousNode)) {
                    setAttr(previousEl, "aria-hidden", "true");
                }
                else {
                    removeAttr(previousEl, "aria-hidden");
                }
            }
        }
        if (nodeId !== null) {
            var el = this.elements.get(nodeId);
            if (el)
                setAttr(el, "aria-hidden", "true");
        }
    };
    /**
     * Describe the focused text field on the host and hide its element; no-op unless
     * semantics changed.
     * @param force - apply even if semantics are unchanged (session start).
     */
    AccessibilityOverlay.prototype.syncEditingHost = function (tree, host, force) {
        var _a;
        if (!force && tree.semanticVersion === this.editingHostSemanticVersion)
            return;
        this.editingHostSemanticVersion = tree.semanticVersion;
        var node = tree.focusedNode();
        if (node === undefined || node.role !== _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.textField) {
            // Nothing to describe; drop the stale description rather than misname the host.
            if (this.editingHostNodeId !== null) {
                host.resetDecoration();
                this.setEditingHostNode(null);
            }
            return;
        }
        // Every key is passed on every call, nulls included, so nothing survives from
        // the previously described field.
        host.setSecure((0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(node.stateFlags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Obscured));
        host.decorate({
            "aria-label": node.label || null,
            "aria-readonly": (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(node.stateFlags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.ReadOnly) ? "true" : null,
            "aria-multiline": (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(node.stateFlags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Multiline) ? "true" : null,
            // Trait-gated to match applyAttributes.
            "aria-required": (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasTrait)(node.traitFlags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticTrait.Requirable) &&
                (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(node.stateFlags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Required)
                ? "true"
                : null,
            // The hint span applyAttributes maintains (update() runs earlier in the frame).
            "aria-describedby": (node.hint && ((_a = this.descElements.get(node.id)) === null || _a === void 0 ? void 0 : _a.id)) || null,
        });
        this.setEditingHostNode(node.id);
    };
    /** True while the editing host stands in for a node's element. */
    AccessibilityOverlay.prototype.hasEditingHost = function () {
        return this.editingHostNodeId !== null;
    };
    /**
     * Undo the stand-in; if the host still has DOM focus, move it to the focused node's
     * element so AT announces it.
     */
    AccessibilityOverlay.prototype.releaseEditingHost = function (tree, host) {
        var _a;
        host === null || host === void 0 ? void 0 : host.resetDecoration();
        this.setEditingHostNode(null);
        this.editingHostSemanticVersion = -1;
        if (!(host === null || host === void 0 ? void 0 : host.hasDomFocus()))
            return;
        var focusedNodeId = (_a = tree === null || tree === void 0 ? void 0 : tree.focusedNode()) === null || _a === void 0 ? void 0 : _a.id;
        if (focusedNodeId !== undefined)
            this.focusNodeElement(focusedNodeId);
    };
    /** Move DOM focus onto a node's element. No-op for a node with no element. */
    AccessibilityOverlay.prototype.focusNodeElement = function (nodeId) {
        var el = this.elements.get(nodeId);
        if (!el)
            return;
        this.focusElementInPlace(el);
    };
    // The overlay is positioned outside the canvas's scroll chain, so a plain focus()
    // would scroll the root instead; scroll the canvas into view through its real ancestors.
    AccessibilityOverlay.prototype.focusElementInPlace = function (el) {
        var _a, _b;
        this.syncContainerBeforeFocus();
        el.focus({ preventScroll: true });
        (_b = (_a = this.canvas).scrollIntoView) === null || _b === void 0 ? void 0 : _b.call(_a, {
            block: "nearest",
            inline: "nearest",
            behavior: "instant",
        });
        // The scroll moved the canvas; re-align now rather than after the observer throttle.
        this.syncContainerGeometry();
        this.observePosition();
    };
    AccessibilityOverlay.prototype.getSemanticOverlayContainer = function () {
        return this.container;
    };
    // ---- Container lifecycle ----
    // Keep the a11y tree overlay matched to the canvas's position and size:
    // 1. The canvas resized           — ResizeObserver
    // 2. The canvas's parent resized   — ResizeObserver
    // 3. The window resized            — resize event
    // 4. The canvas moved/drifted      — IntersectionObserver (see observePosition)
    AccessibilityOverlay.prototype.attachPositionObservers = function () {
        var _this = this;
        this.canvasResizeObserver = new ResizeObserver(function () { return _this.scheduleReposition(); });
        this.canvasResizeObserver.observe(this.canvas);
        var parent = this.canvas.parentElement;
        if (parent) {
            this.parentResizeObserver = new ResizeObserver(function () { return _this.scheduleReposition(); });
            this.parentResizeObserver.observe(parent);
        }
        window.addEventListener("resize", this._onWindowResize);
        this.observePosition();
    };
    /**
     * Arms an IntersectionObserver whose root box is bounded to the canvas, so it
     * fires when the canvas moves relative to the viewport — position drift that
     * no ResizeObserver reports. Lets us re-sync the overlay container on a move
     * instead of recalculating the canvas bounding box every frame.
     */
    AccessibilityOverlay.prototype.observePosition = function () {
        var _this = this;
        var _a;
        if (typeof IntersectionObserver === "undefined")
            return;
        (_a = this.positionObserver) === null || _a === void 0 ? void 0 : _a.disconnect();
        this.positionObserver = null;
        var rect = this.canvas.getBoundingClientRect();
        // Can't frame a zero-area element; it will re-arm on the next reposition.
        if (!rect.width || !rect.height)
            return;
        // Shrink the viewport root box down to exactly the canvas: a negative inset
        // from each viewport edge to the matching canvas edge, in CSS shorthand
        // order (top, right, bottom, left). Rounded so sub-pixel jitter doesn't trip
        // the 1.0 threshold.
        var insetToPx = function (v) { return "".concat(-Math.round(v), "px"); };
        var rootMargin = [
            rect.top, // top:    viewport top → canvas top
            window.innerWidth - rect.right, // right:  viewport right → canvas right
            window.innerHeight - rect.bottom, // bottom: viewport bottom → canvas bottom
            rect.left, // left:   viewport left → canvas left
        ]
            .map(insetToPx)
            .join(" ");
        // The observer emits an initial notification for the current (contained)
        // state; ignore that and only react to a subsequent move.
        var armed = false;
        this.positionObserver = new IntersectionObserver(function () {
            if (!armed) {
                armed = true;
                return;
            }
            _this.scheduleReposition();
        }, { threshold: 1.0, rootMargin: rootMargin });
        this.positionObserver.observe(this.canvas);
    };
    AccessibilityOverlay.prototype.scheduleReposition = function () {
        var _this = this;
        // A resize/move may have changed canvas size/scale/position; force a
        // transform recompute on the next frame's update.
        this._geometryDirty = true;
        if (this.repositionTimer !== null)
            return;
        this.repositionTimer = setTimeout(function () {
            _this.repositionTimer = null;
            _this.syncContainerGeometry();
            // Re-arm the position observer at the canvas's new location.
            _this.observePosition();
        }, 500); // Throttle to avoid rapid style recalculations
    };
    /** Returns true when the container's size changed (node transforms need recomputing). */
    AccessibilityOverlay.prototype.syncContainerGeometry = function () {
        var rect = this.canvas.getBoundingClientRect();
        var _a = (0,_utils_canvasOffset__WEBPACK_IMPORTED_MODULE_1__.canvasOffset)(this.canvas), top = _a.top, left = _a.left;
        var sizeChanged = rect.width !== this.lastCanvasPositioning.width ||
            rect.height !== this.lastCanvasPositioning.height;
        if (!sizeChanged &&
            top === this.lastCanvasPositioning.offsetTop &&
            left === this.lastCanvasPositioning.offsetLeft)
            return false;
        this.container.style.top = top + "px";
        this.container.style.left = left + "px";
        this.container.style.width = rect.width + "px";
        this.container.style.height = rect.height + "px";
        this.container.tabIndex = -1;
        this.lastCanvasPositioning.width = rect.width;
        this.lastCanvasPositioning.height = rect.height;
        this.lastCanvasPositioning.offsetTop = top;
        this.lastCanvasPositioning.offsetLeft = left;
        return sizeChanged;
    };
    /**
     * Re-align the container right before focusing one of its elements. The position
     * observer re-syncs after scrolling on a throttle; focusing an element while the
     * container is stale would make the browser scroll the page to where it sits.
     */
    AccessibilityOverlay.prototype.syncContainerBeforeFocus = function () {
        if (this.syncContainerGeometry())
            this._geometryDirty = true;
    };
    AccessibilityOverlay.prototype.createContainer = function (canvas) {
        var _a, _b;
        var container = document.createElement("div");
        container.id = "rive-a11y-".concat(this.instanceId);
        container.setAttribute("role", "region");
        container.setAttribute("aria-label", (_b = (_a = this.semanticsOptions) === null || _a === void 0 ? void 0 : _a.riveCanvasLabel) !== null && _b !== void 0 ? _b : "Rive animation");
        // Size to the canvas's CSS layout box, not the parent container.
        var rect = canvas.getBoundingClientRect();
        var _c = (0,_utils_canvasOffset__WEBPACK_IMPORTED_MODULE_1__.canvasOffset)(this.canvas), top = _c.top, left = _c.left;
        container.style.cssText = [
            "position:absolute",
            "top:".concat(top, "px"),
            "left:".concat(left, "px"),
            "line-height:normal",
            "font-size:16px",
            "width:".concat(rect.width, "px"),
            "height:".concat(rect.height, "px"),
            "overflow:hidden",
            "pointer-events:none",
            // Visually hidden but still in the accessibility tree.
            // `display:none` and `visibility:hidden` would hide from AT.
            "opacity:0",
        ].join(";");
        canvas.insertAdjacentElement("afterend", container);
        return container;
    };
    /**
     * Returns what changed since the last update, or null if nothing changed.
     *
     * Callers use this to avoid recomputing the (relatively expensive)
     * artboard→canvas transform on frames where only node bounds changed in the
     * tree: the transform only needs recomputing when `layoutChanged` is true.
     */
    AccessibilityOverlay.prototype.needsUpdate = function (tree) {
        var semanticChanged = tree.semanticVersion !== this.lastSemanticVersion;
        var nodeGeometryChanged = tree.geometryVersion !== this.lastGeometryVersion;
        var layoutChanged = this._geometryDirty || !this.transformContainer;
        if (!semanticChanged && !nodeGeometryChanged && !layoutChanged)
            return null;
        return { semanticChanged: semanticChanged, nodeGeometryChanged: nodeGeometryChanged, layoutChanged: layoutChanged };
    };
    /**
     * Update the overlay DOM to reflect the current state of the semantic tree.
     * Call once per frame after `applyDiff` when {@link needsUpdate} reports a
     * change, when layout/transform inputs are dirty, or when a fresh
     * `forwardMat` is supplied (even if the tree versions are unchanged).
     *
     * @param tree           The in-memory semantic tree model
     * @param forwardMat     Artboard→canvas-pixel transform from `computeAlignment`,
     *                       or null to reuse the existing CSS transform on the
     *                       transform container
     * @param dpr            Device pixel ratio used for the canvas backing store
     * @param artboardBounds The artboard's own bounding rectangle
     */
    AccessibilityOverlay.prototype.update = function (tree, forwardMat, dpr, artboardBounds, change) {
        var overlayChange = change !== null && change !== void 0 ? change : this.needsUpdate(tree);
        if (!overlayChange && forwardMat) {
            overlayChange = {
                semanticChanged: false,
                nodeGeometryChanged: false,
                layoutChanged: true,
            };
        }
        if (!overlayChange)
            return;
        this.performUpdate(tree, forwardMat, dpr, artboardBounds, overlayChange);
    };
    AccessibilityOverlay.prototype.performUpdate = function (tree, forwardMat, dpr, artboardBounds, change) {
        var _a;
        var semanticChanged = change.semanticChanged, nodeGeometryChanged = change.nodeGeometryChanged;
        // Per-node change sets only describe the most recent applyDiff. If more
        // than one semantic version elapsed since our last update (first build,
        // or a diff we never consumed), fall back to re-applying attributes on
        // every node rather than trusting an incomplete set.
        var reapplyAllAttributes = tree.semanticVersion - this.lastSemanticVersion > 1;
        this.lastSemanticVersion = tree.semanticVersion;
        this.lastGeometryVersion = tree.geometryVersion;
        this.isUpdating = true;
        this._artboardBounds = artboardBounds;
        // Container box + artboard transform only run when a fresh forwardMat was
        // supplied (layout/transform dirty). Node-only bounds updates reuse the
        // existing CSS transform and go through updateGeometryForChangedNodes.
        // Skipping syncContainerGeometry here on semantic-only frames avoids a
        // getBoundingClientRect() reflow on every animation frame. The throttled
        // scheduleReposition() path still keeps the container aligned when the page
        // layout shifts.
        if (forwardMat) {
            this.syncContainerGeometry();
            this.syncTransformContainer(forwardMat, dpr, artboardBounds);
            // Transform is now in sync with the latest layout.
            this._geometryDirty = false;
        }
        if (semanticChanged) {
            var rootEl = (_a = this.transformContainer) !== null && _a !== void 0 ? _a : this.container;
            var activeIds_1 = new Set();
            this.rebuildChildren(rootEl, tree.roots, tree, 0, // parentLeft in artboard space (transform container origin)
            0, // parentTop  in artboard space
            activeIds_1, reapplyAllAttributes);
            var staleIds_2 = [];
            this.elements.forEach(function (_el, id) {
                if (!activeIds_1.has(id))
                    staleIds_2.push(id);
            });
            for (var _i = 0, staleIds_1 = staleIds_2; _i < staleIds_1.length; _i++) {
                var id = staleIds_1[_i];
                var el = this.elements.get(id);
                if (el && el.parentNode)
                    el.parentNode.removeChild(el);
                this.elements.delete(id);
                var desc = this.descElements.get(id);
                if (desc && desc.parentNode)
                    desc.parentNode.removeChild(desc);
                this.descElements.delete(id);
            }
        }
        else if (nodeGeometryChanged) {
            this.updateGeometryForChangedNodes(tree);
        }
        // Text scaling needs layout reads; batch them into one pass after all
        // position/attribute writes so each frame forces at most one reflow.
        this.flushTextGeometry();
        this.isUpdating = false;
    };
    /** Remove the overlay from the DOM entirely. */
    AccessibilityOverlay.prototype.destroy = function () {
        var _a, _b, _c;
        if (this.repositionTimer !== null) {
            clearTimeout(this.repositionTimer);
            this.repositionTimer = null;
        }
        window.removeEventListener("resize", this._onWindowResize);
        (_a = this.canvasResizeObserver) === null || _a === void 0 ? void 0 : _a.disconnect();
        (_b = this.parentResizeObserver) === null || _b === void 0 ? void 0 : _b.disconnect();
        (_c = this.positionObserver) === null || _c === void 0 ? void 0 : _c.disconnect();
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.elements.clear();
        this.descElements.clear();
        this.pendingTextGeometry.length = 0;
    };
    // ---- Tree → DOM reconciliation ----
    /**
     * Reconcile a parent DOM element's children with an ordered list of
     * semantic node IDs. Creates, updates, and reorders elements as needed.
     *
     * Node positions are expressed in artboard-space coordinates. The CSS
     * transform on the transform container maps artboard units to CSS pixels,
     * so no per-node matrix multiplication is required here.
     *
     * @param parentArtboardLeft  Absolute artboard minX of the parent node (0 for roots)
     * @param parentArtboardTop   Absolute artboard minY of the parent node (0 for roots)
     */
    AccessibilityOverlay.prototype.rebuildChildren = function (parentEl, childIds, tree, parentArtboardLeft, parentArtboardTop, activeIds, applyAllAttributes) {
        for (var i = 0; i < childIds.length; i++) {
            var nodeId = childIds[i];
            var nodeData = tree.nodeById(nodeId);
            if (!nodeData)
                continue;
            activeIds.add(nodeId);
            var el = this.elements.get(nodeId);
            var isNew = !el;
            if (!el) {
                el = this.createElement(nodeData);
                this.elements.set(nodeId, el);
            }
            // Attributes are only applied to new elements and nodes whose semantic
            // fields changed in the latest diff. Skipping redundant setAttribute
            // calls eliminates WebKit AX notifications that knock VoiceOver off its
            // current element.
            if (isNew || applyAllAttributes || tree.semanticChangedIds.has(nodeId)) {
                this.applyAttributes(el, nodeData);
            }
            this.applyPosition(el, nodeData, parentArtboardLeft, parentArtboardTop);
            // Only touch the DOM tree if the element isn't already in the correct
            // position. Moving a focused element can blur it and knock AT off the
            // current node.
            var currentChild = parentEl.children[i];
            if (currentChild !== el) {
                if (currentChild) {
                    parentEl.insertBefore(el, currentChild);
                }
                else {
                    parentEl.appendChild(el);
                }
            }
            // Reflect the runtime Focused state into DOM focus. Runs after insertion
            // so the element is attached, and skips elements that already hold focus.
            // The cheap trait/state flag checks gate the (per-node) DOM queries below,
            // so the activeElement/closest/contains walks only run for a node that is
            // actually focusable + focused — not for every node on every frame.
            if ((0,_types__WEBPACK_IMPORTED_MODULE_2__.hasTrait)(nodeData.traitFlags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticTrait.Focusable) &&
                (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(nodeData.stateFlags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Focused)) {
                var active = document.activeElement;
                // While focus is inside one of our modal dialogs, don't pull it back
                // out to a background node.
                var focusedModal = active === null || active === void 0 ? void 0 : active.closest('[aria-modal="true"]');
                var trappedByModal = !!focusedModal &&
                    this.container.contains(focusedModal) &&
                    !focusedModal.contains(el);
                // Not while the proxy has focus (would steal the caret, drop the keyboard) nor onto
                // its aria-hidden stand-in.
                if (nodeId !== this.editingHostNodeId &&
                    active !== el &&
                    !trappedByModal &&
                    !this.isEditingHostFocused() &&
                    this.canMoveFocus()) {
                    // No scrollIntoView: this runs on semantic diffs and must not drag the page.
                    this.syncContainerBeforeFocus();
                    el.focus({ preventScroll: true });
                }
            }
            // Recurse into children with this node's absolute artboard position.
            if (nodeData.children.length > 0) {
                this.rebuildChildren(el, nodeData.children, tree, nodeData.minX, nodeData.minY, activeIds, applyAllAttributes);
            }
            // Focus a modal/alert dialog when it first appears (after children are
            // built so the focus target can be resolved from the subtree).
            if (isNew)
                this.autoFocusDialogOnAppear(el, nodeData, tree);
        }
    };
    /**
     * Reposition only the subtrees whose bounds changed in the latest diff.
     * Descendants are included because node CSS positions are parent-relative.
     */
    AccessibilityOverlay.prototype.updateGeometryForChangedNodes = function (tree) {
        var _a, _b;
        for (var _i = 0, _c = Array.from(tree.geometryChangedIds); _i < _c.length; _i++) {
            var nodeId = _c[_i];
            var nodeData = tree.nodeById(nodeId);
            if (!nodeData)
                continue;
            var parentLeft = 0;
            var parentTop = 0;
            var parentEl = (_a = this.transformContainer) !== null && _a !== void 0 ? _a : this.container;
            if (nodeData.parentId >= 0) {
                var parent_1 = tree.nodeById(nodeData.parentId);
                if (parent_1) {
                    parentLeft = parent_1.minX;
                    parentTop = parent_1.minY;
                    parentEl = (_b = this.elements.get(nodeData.parentId)) !== null && _b !== void 0 ? _b : parentEl;
                }
            }
            this.updateNodeGeometrySubtree(tree, nodeId, parentLeft, parentTop, parentEl);
        }
    };
    AccessibilityOverlay.prototype.updateNodeGeometrySubtree = function (tree, nodeId, parentArtboardLeft, parentArtboardTop, _parentEl) {
        var nodeData = tree.nodeById(nodeId);
        if (!nodeData)
            return;
        var el = this.elements.get(nodeId);
        if (!el)
            return;
        this.applyPosition(el, nodeData, parentArtboardLeft, parentArtboardTop);
        for (var _i = 0, _a = nodeData.children; _i < _a.length; _i++) {
            var childId = _a[_i];
            this.updateNodeGeometrySubtree(tree, childId, nodeData.minX, nodeData.minY, el);
        }
    };
    /**
     * Whether the overlay may move focus now. Following focus already inside this
     * instance is always allowed; pulling it in from the host page is gated behind
     * allowFocusInterrupt (from the Rive class).
     */
    AccessibilityOverlay.prototype.canMoveFocus = function () {
        var active = document.activeElement;
        var focusAlreadyInScope = active === this.canvas || this.container.contains(active);
        return focusAlreadyInScope || this.allowFocusInterrupt;
    };
    /**
     * Move focus into a newly appeared modal/alert dialog so screen readers
     * announce and read its content (web ATs don't auto-enter a freshly mounted
     * dialog). Skips when focus can't move (see canMoveFocus) or a descendant
     * already holds it. The dialog's aria-modal keeps focus trapped inside.
     */
    AccessibilityOverlay.prototype.autoFocusDialogOnAppear = function (el, node, tree) {
        var _a;
        if (!isModalDialogRole(node.role, node.stateFlags))
            return;
        if (!this.canMoveFocus())
            return;
        // A descendant already holds focus — don't override it.
        var active = document.activeElement;
        if (active && active !== el && el.contains(active))
            return;
        var target = (_a = this.routeDefaultFocusTarget(node, tree)) !== null && _a !== void 0 ? _a : el;
        if (!target.hasAttribute("tabindex"))
            target.setAttribute("tabindex", "-1");
        if (document.activeElement !== target)
            target.focus({ preventScroll: true });
    };
    /**
     * Resolve the element assistive technologies (AT) should focus on appearance. Walks the subtree
     * depth-first and returns the first focusable node's host element, else the
     * inner <span> of the first labeled leaf. Container and unlabeled nodes are
     * descended into but never focused. Returns null if nothing qualifies.
     */
    AccessibilityOverlay.prototype.routeDefaultFocusTarget = function (node, tree) {
        var _a;
        for (var _i = 0, _b = node.children; _i < _b.length; _i++) {
            var childId = _b[_i];
            var child = tree.nodeById(childId);
            if (!child)
                continue;
            var childEl = this.elements.get(childId);
            // Focusable node → its host element (even if it has children).
            if (childEl && isFocusableNode(child))
                return childEl;
            // Container or unlabeled node → descend without focusing it.
            if (child.children.length > 0 || !child.label) {
                var nested = this.routeDefaultFocusTarget(child, tree);
                if (nested)
                    return nested;
                continue;
            }
            // Labeled leaf → its inner label span.
            if (childEl) {
                return (_a = childEl.querySelector(":scope > span")) !== null && _a !== void 0 ? _a : childEl;
            }
        }
        return null;
    };
    Object.defineProperty(AccessibilityOverlay.prototype, "nodeIdPrefix", {
        // ---- Element creation ----
        /** Shared `id` prefix for all semantic node elements of this instance. */
        get: function () {
            return "rive-".concat(this.instanceId, "-sem-");
        },
        enumerable: false,
        configurable: true
    });
    /** Recover the semantic node ID from an overlay element, or null. */
    AccessibilityOverlay.prototype.nodeIdFromElement = function (el) {
        if (!el.id.startsWith(this.nodeIdPrefix))
            return null;
        var raw = el.id.slice(this.nodeIdPrefix.length);
        // Guard the empty string explicitly: Number("") is 0, not NaN.
        if (!raw)
            return null;
        var id = Number(raw);
        return Number.isNaN(id) ? null : id;
    };
    AccessibilityOverlay.prototype.createElement = function (node) {
        var tag = tagForRole(node.role);
        var el = document.createElement(tag);
        el.id = "".concat(this.nodeIdPrefix).concat(node.id);
        el.style.cssText = BASE_NODE_STYLE;
        if (node.role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.text) {
            // The positioned outer div is the AX element
            // VoiceOver uses for its highlight box; an inner <span> carries the text
            // without position:absolute (which would strip the span from VoiceOver's
            // bounds calculation).
            var textSpan = document.createElement("span");
            textSpan.style.cssText = SPAN_EXP;
            el.appendChild(textSpan);
        }
        this.attachActionHandlers(el, node);
        return el;
    };
    // ---- Action handlers ----
    /**
     * Wire arrow-key roving focus for a group member (tab, radio). Arrow keys
     * move focus to the next/previous member (wrapping), optionally Home/End jump
     * to first/last, and the newly focused member receives a tap action.
     */
    AccessibilityOverlay.prototype.attachRovingNav = function (el, opts) {
        var _this = this;
        el.addEventListener("keydown", function (e) {
            var target = null;
            if (e.key === "ArrowRight" || e.key === "ArrowDown")
                target = "next";
            else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
                target = "prev";
            else if (opts.includeHomeEnd && e.key === "Home")
                target = "first";
            else if (opts.includeHomeEnd && e.key === "End")
                target = "last";
            if (!target)
                return;
            (0,_claimedKeyEvents__WEBPACK_IMPORTED_MODULE_0__.claimKeyEvent)(e);
            var members = opts.members();
            var idx = members.indexOf(el);
            if (idx < 0)
                return;
            var n = members.length;
            var next = target === "next" ? members[(idx + 1) % n]
                : target === "prev" ? members[(idx - 1 + n) % n]
                    : target === "first" ? members[0]
                        : members[n - 1];
            if (next && next !== el) {
                _this.focusElementInPlace(next);
                var nextId = _this.nodeIdFromElement(next);
                if (nextId !== null)
                    _this.fireAction(nextId, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticActionType.tap);
            }
        });
    };
    AccessibilityOverlay.prototype.attachActionHandlers = function (el, node) {
        var _this = this;
        var role = node.role;
        var nodeId = node.id;
        if (isClickableRole(role)) {
            el.addEventListener("click", function () {
                _this.fireAction(nodeId, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticActionType.tap);
            });
            // Links activate on Enter only (Space scrolls the page per browser
            // convention). All other clickable roles accept both Enter and Space.
            var activationKeys_1 = role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.link ? ["Enter"] : ["Enter", " "];
            el.addEventListener("keydown", function (e) {
                if (activationKeys_1.includes(e.key)) {
                    (0,_claimedKeyEvents__WEBPACK_IMPORTED_MODULE_0__.claimKeyEvent)(e);
                    _this.fireAction(nodeId, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticActionType.tap);
                }
            });
        }
        if (role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.slider) {
            el.addEventListener("keydown", function (e) {
                if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                    (0,_claimedKeyEvents__WEBPACK_IMPORTED_MODULE_0__.claimKeyEvent)(e);
                    _this.fireAction(nodeId, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticActionType.increase);
                }
                else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                    (0,_claimedKeyEvents__WEBPACK_IMPORTED_MODULE_0__.claimKeyEvent)(e);
                    _this.fireAction(nodeId, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticActionType.decrease);
                }
            });
        }
        if (role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.tab) {
            this.attachRovingNav(el, {
                includeHomeEnd: true,
                members: function () {
                    var parent = el.parentElement;
                    if (!parent)
                        return [];
                    return Array.from(parent.children).filter(function (c) {
                        return c instanceof HTMLElement && c.getAttribute("role") === "tab";
                    });
                },
            });
        }
        if (role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.radioButton) {
            this.attachRovingNav(el, {
                includeHomeEnd: false,
                members: function () {
                    var _a;
                    var group = (_a = el.closest('[role="radiogroup"]')) !== null && _a !== void 0 ? _a : el.parentElement;
                    if (!group)
                        return [];
                    return Array.from(group.querySelectorAll('[role="radio"]'));
                },
            });
        }
        // Focus handler for nodes with the Focusable trait. When AT focuses an
        // element, notify the C++ runtime so it can update internal focus state
        // (visual focus rings, etc.). Gated on Focusable trait
        if ((0,_types__WEBPACK_IMPORTED_MODULE_2__.hasTrait)(node.traitFlags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticTrait.Focusable)) {
            el.addEventListener("focus", function () {
                _this.requestFocus(nodeId);
            });
        }
    };
    // ---- Attribute application ----
    AccessibilityOverlay.prototype.isAriaHidden = function (node) {
        var role = node.role;
        var flags = node.stateFlags;
        // Hide from AT when explicitly hidden, or when an image has no accessible
        // name — a nameless role="img" is a WCAG 1.1.1 violation; treat it as
        // decorative instead.
        var isDecorativeImage = role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.image && !node.label;
        // The <input> proxy is the accessible element for the node it stands in for.
        var isEditingHostStandIn = node.id === this.editingHostNodeId;
        return ((0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Hidden) ||
            // Obscured text fields stay reachable (value withheld, like a native password input).
            ((0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Obscured) && role !== _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.textField) ||
            isDecorativeImage ||
            isEditingHostStandIn);
    };
    AccessibilityOverlay.prototype.applyAttributes = function (el, node) {
        var _a, _b, _c;
        this.appliedNodes.set(el, node);
        var role = node.role;
        var flags = node.stateFlags;
        var traits = node.traitFlags;
        // Role
        var ariaRole = ariaRoleForSemantic(role);
        if (ariaRole) {
            setAttr(el, "role", ariaRole);
        }
        else {
            removeAttr(el, "role");
        }
        // Links: a bare <a> with no href has no link semantics, so set the role
        // explicitly (ariaRoleForSemantic returns null for link → native <a>).
        if (role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.link) {
            setAttr(el, "role", "link");
        }
        // Tabindex — keep the screen-reader overlay out of the browser's sequential
        // Tab order. Interactive/focusable nodes remain programmatically focusable
        // so AT/runtime focus sync can still target them when needed. List items are
        // included because Mobile Safari won't iterate them otherwise.
        if (isInteractiveRole(role) ||
            (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasTrait)(traits, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticTrait.Focusable) ||
            role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.listItem) {
            setAttr(el, "tabindex", "-1");
        }
        else {
            removeAttr(el, "tabindex");
        }
        // Label / value / hint
        if (node.label) {
            setAttr(el, "aria-label", node.label);
        }
        else {
            removeAttr(el, "aria-label");
        }
        if (role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.slider) {
            if (node.value) {
                // aria-valuenow must be numeric; keep the display string (e.g. "75%")
                // in aria-valuetext only.
                var numericValue = parseFloat(node.value);
                if (Number.isFinite(numericValue)) {
                    setAttr(el, "aria-valuenow", String(numericValue));
                }
                else {
                    removeAttr(el, "aria-valuenow");
                }
                setAttr(el, "aria-valuetext", node.value);
            }
            else {
                removeAttr(el, "aria-valuenow");
                removeAttr(el, "aria-valuetext");
            }
            // TODO: aria-valuemin / aria-valuemax are required by ARIA.
            // Defaulting to horizontal; vertical sliders need orientation data from C++.
            setAttr(el, "aria-orientation", "horizontal");
            setBoolAttr(el, "aria-readonly", (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.ReadOnly));
        }
        else {
            removeAttr(el, "aria-valuenow");
            removeAttr(el, "aria-valuetext");
            removeAttr(el, "aria-orientation");
            removeAttr(el, "aria-readonly");
        }
        if (node.hint) {
            var descId = "rive-".concat(this.instanceId, "-desc-").concat(node.id);
            var descEl = this.descElements.get(node.id);
            if (!descEl) {
                descEl = document.createElement("span");
                descEl.id = descId;
                descEl.style.cssText = DESC_SPAN_STYLE;
                this.container.appendChild(descEl);
                this.descElements.set(node.id, descEl);
            }
            if (descEl.textContent !== node.hint)
                descEl.textContent = node.hint;
            setAttr(el, "aria-describedby", descId);
        }
        else {
            removeAttr(el, "aria-describedby");
            var staleDesc = this.descElements.get(node.id);
            if (staleDesc) {
                if (staleDesc.parentNode)
                    staleDesc.parentNode.removeChild(staleDesc);
                this.descElements.delete(node.id);
            }
        }
        // Text nodes: use textContent rather than aria-label so screen readers
        // announce the text in virtual/browse mode (aria-label on a bare <span>
        // with no widget role is ignored by some AT in document browse mode).
        if (role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.text) {
            var textSpan = (_a = el.querySelector(":scope > span")) !== null && _a !== void 0 ? _a : el;
            var text = (_b = node.label) !== null && _b !== void 0 ? _b : "";
            if (textSpan.textContent !== text)
                textSpan.textContent = text;
            removeAttr(el, "aria-label");
            if (node.headingLevel > 0) {
                setAttr(el, "role", "heading");
                setAttr(el, "aria-level", String(node.headingLevel));
            }
            else {
                // The generic role branch above already cleared role="heading";
                // aria-level must go with it when a heading reverts to plain text.
                removeAttr(el, "aria-level");
            }
        }
        // ---- Trait-gated states ----
        // Only set the ARIA property when the trait is present. When the trait
        // is absent, remove the attribute so AT sees "not applicable" rather
        // than "false".
        if ((0,_types__WEBPACK_IMPORTED_MODULE_2__.hasTrait)(traits, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticTrait.Expandable) && ARIA_EXPANDED_ROLES.has(role)) {
            setBoolAttr(el, "aria-expanded", (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Expanded));
        }
        else {
            removeAttr(el, "aria-expanded");
        }
        // aria-selected is required on ALL tabs per ARIA spec regardless of trait;
        // for other roles it is trait-gated and guarded to ARIA_SELECTED_ROLES.
        if (role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.tab) {
            setBoolAttr(el, "aria-selected", (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Selected));
        }
        else if ((0,_types__WEBPACK_IMPORTED_MODULE_2__.hasTrait)(traits, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticTrait.Selectable) && ARIA_SELECTED_ROLES.has(role)) {
            setBoolAttr(el, "aria-selected", (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Selected));
        }
        else {
            removeAttr(el, "aria-selected");
        }
        if ((0,_types__WEBPACK_IMPORTED_MODULE_2__.hasTrait)(traits, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticTrait.Checkable) && ARIA_CHECKED_ROLES.has(role)) {
            // Check state is a tri-state field, but not every checkable role
            // accepts all three values — see ARIA_MIXED_ROLES.
            var checkState = (0,_types__WEBPACK_IMPORTED_MODULE_2__.checkStateOf)(flags);
            if (checkState === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticCheckState.Mixed &&
                ARIA_MIXED_ROLES.has(role)) {
                setAttr(el, "aria-checked", "mixed");
            }
            else {
                setBoolAttr(el, "aria-checked", checkState === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticCheckState.Checked);
            }
        }
        else {
            removeAttr(el, "aria-checked");
        }
        if ((0,_types__WEBPACK_IMPORTED_MODULE_2__.hasTrait)(traits, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticTrait.Toggleable)) {
            if (ARIA_PRESSED_ROLES.has(role)) {
                setBoolAttr(el, "aria-pressed", (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Toggled));
            }
            else {
                removeAttr(el, "aria-pressed");
            }
            // switch uses aria-checked (not aria-pressed) for its on/off state.
            if (role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.switchControl) {
                setBoolAttr(el, "aria-checked", (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Toggled));
            }
        }
        else {
            removeAttr(el, "aria-pressed");
        }
        if ((0,_types__WEBPACK_IMPORTED_MODULE_2__.hasTrait)(traits, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticTrait.Requirable) && ARIA_REQUIRED_ROLES.has(role)) {
            setBoolAttr(el, "aria-required", (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Required));
        }
        else {
            removeAttr(el, "aria-required");
        }
        if ((0,_types__WEBPACK_IMPORTED_MODULE_2__.hasTrait)(traits, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticTrait.Enablable)) {
            setBoolAttr(el, "aria-disabled", (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Disabled));
        }
        else {
            removeAttr(el, "aria-disabled");
        }
        // ---- Non-trait states ----
        if (this.isAriaHidden(node)) {
            setAttr(el, "aria-hidden", "true");
        }
        else {
            removeAttr(el, "aria-hidden");
        }
        if ((0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.LiveRegion)) {
            setAttr(el, "aria-live", "polite");
        }
        else {
            removeAttr(el, "aria-live");
        }
        // textField-specific
        // TODO: Details here may change once we implement text inputs
        if (role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.textField) {
            setBoolAttr(el, "aria-readonly", (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.ReadOnly));
            setBoolAttr(el, "aria-multiline", (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Multiline));
            // Surface the current field value as DOM text so screen readers can
            // announce it. Only safe when the node has no semantic children —
            // setting textContent would remove any child elements from the DOM.
            if (node.children.length === 0) {
                var value = (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Obscured) ? "" : ((_c = node.value) !== null && _c !== void 0 ? _c : "");
                if (el.textContent !== value)
                    el.textContent = value;
            }
            else {
                // A value rendered earlier (before the node had children) must not linger,
                // least of all once the field turns Obscured.
                for (var _i = 0, _d = Array.from(el.childNodes); _i < _d.length; _i++) {
                    var child = _d[_i];
                    if (child.nodeType === Node.TEXT_NODE)
                        child.remove();
                }
            }
        }
        else {
            removeAttr(el, "aria-multiline");
        }
        // alertDialog is always modal per WAI-ARIA; a plain dialog only when the Modal state flag is set.
        if (isModalDialogRole(role, flags)) {
            setAttr(el, "aria-modal", "true");
        }
        else {
            removeAttr(el, "aria-modal");
        }
    };
    // ---- Positioning ----
    /**
     * Positions an element in artboard-space coordinates relative to its parent.
     *
     * Node bounds stay in raw artboard units — the CSS `transform: matrix(...)`
     * on the transform container maps artboard units to CSS pixels in one GPU
     * pass. No per-node forwardMat multiplication or DPR division needed here.
     *
     * Round to whole artboard units before comparing to avoid triggering AX
     * layout notifications from sub-unit floating-point animation jitter.
     */
    AccessibilityOverlay.prototype.applyPosition = function (el, node, parentArtboardLeft, parentArtboardTop) {
        // Clamp each node's rect to the artboard viewport before computing CSS.
        // Without this, nodes whose artboard bounds exceed the artboard (e.g. a
        // scroll list container whose height is the full content, not the viewport)
        // produce CSS heights that overflow the transform container. WebKit then
        // unions all descendant AX rects and extends the container's AX origin
        // above the canvas regardless of overflow:hidden on ancestors.
        var ab = this._artboardBounds;
        var clampedMinX = Math.max(node.minX, ab.minX);
        var clampedMinY = Math.max(node.minY, ab.minY);
        var clampedMaxX = Math.min(node.maxX, ab.maxX);
        var clampedMaxY = Math.min(node.maxY, ab.maxY);
        var elLeft = clampedMinX - parentArtboardLeft;
        var elTop = clampedMinY - parentArtboardTop;
        var elWidth = Math.max(0, clampedMaxX - clampedMinX);
        var elHeight = Math.max(0, clampedMaxY - clampedMinY);
        var tx = Math.round(elLeft);
        var ty = Math.round(elTop);
        var pxWidth = Math.round(elWidth) + "px";
        var pxHeight = Math.round(elHeight) + "px";
        // Use left/top layout properties for positioning. VoiceOver reliably
        // handles layout position + a single ancestor CSS transform (the transform
        // container). Chaining CSS transforms across multiple stacking contexts
        // (transform container → node identity → item translate) caused VoiceOver
        // to compute the correct SIZE but wrong POSITION. Artboard clamping above
        // guarantees tx/ty are always ≥ 0, so the negative-top overflow problem
        // that originally prompted the switch to CSS transforms no longer applies.
        var pxLeft = tx + "px";
        var pxTop = ty + "px";
        if (el.style.left !== pxLeft)
            el.style.left = pxLeft;
        if (el.style.top !== pxTop)
            el.style.top = pxTop;
        if (el.style.width !== pxWidth)
            el.style.width = pxWidth;
        if (el.style.height !== pxHeight)
            el.style.height = pxHeight;
        // Clear any CSS transform from a previous render pass.
        if (el.style.transform)
            el.style.transform = "";
        if (node.role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.text) {
            this.pendingTextGeometry.push(el);
        }
    };
    /**
     * Scale each queued text span to fit its layout box, batched so a frame
     * pays at most one synchronous layout: all measurement-reset writes first,
     * then all rect reads, then all transform writes. Interleaving
     * write→read→write per node would force a reflow per text node instead.
     *
     * Nodes whose box size and text are unchanged since the last pass are
     * skipped entirely (their existing transform is still correct — the scale
     * is a ratio of two rects, so ancestor transform changes cancel out).
     */
    AccessibilityOverlay.prototype.flushTextGeometry = function () {
        var _a;
        if (this.pendingTextGeometry.length === 0)
            return;
        // Phase 1 — writes: reset spans to their natural size for measurement.
        // The previous pass's scale must be cleared, or the rect reads below
        // would measure the scaled span and compound the correction.
        var toMeasure = [];
        for (var _i = 0, _b = this.pendingTextGeometry; _i < _b.length; _i++) {
            var host = _b[_i];
            var span = (_a = host.querySelector(":scope > span")) !== null && _a !== void 0 ? _a : host;
            var key = "".concat(host.style.width, "|").concat(host.style.height, "|").concat(span.textContent);
            if (this.textGeometryKeys.get(host) === key)
                continue;
            span.style.width = "auto";
            span.style.height = "auto";
            span.style.transformOrigin = "0 0";
            span.style.transform = "";
            toMeasure.push({ host: host, span: span, key: key });
        }
        this.pendingTextGeometry.length = 0;
        // Phase 2 — reads: one layout pass covers every rect measurement.
        var transforms = toMeasure.map(function (_a) {
            var host = _a.host, span = _a.span;
            var parentRect = host.getBoundingClientRect();
            var natural = span.getBoundingClientRect();
            if (natural.width > 0 && natural.height > 0) {
                var scaleX = parentRect.width / natural.width;
                var scaleY = parentRect.height / natural.height;
                return "scale(".concat(scaleX, ", ").concat(scaleY, ")");
            }
            return "none";
        });
        // Phase 3 — writes: apply all transforms.
        for (var i = 0; i < toMeasure.length; i++) {
            var _c = toMeasure[i], host = _c.host, span = _c.span, key = _c.key;
            span.style.transform = transforms[i];
            this.textGeometryKeys.set(host, key);
        }
    };
    // ---- Transform container ----
    /**
     * Creates (on first call) and updates the artboard-space transform container.
     *
     * The container is sized to the artboard dimensions and carries a CSS
     * `transform: matrix(...)` that maps artboard coordinates to the canvas's CSS box
     * (forwardMat in backing-store pixels, scaled by CSS size / backing-store size). All semantic
     * node elements are children of this container and use raw artboard
     * coordinates as their CSS `left/top/width/height`, so the CSS compositor
     * applies the artboard→screen mapping in one pass.
     */
    AccessibilityOverlay.prototype.syncTransformContainer = function (forwardMat, dpr, artboardBounds) {
        if (!this.transformContainer) {
            var tc = document.createElement("div");
            tc.style.cssText = [
                "position:absolute",
                "top:0",
                "left:0",
                // overflow:visible — artboard viewport clamping is done per-node in
                // applyPosition
                "overflow:visible",
                "pointer-events:none",
                "transform-origin:0 0",
            ].join(";");
            this.container.appendChild(tc);
            this.transformContainer = tc;
        }
        var w = artboardBounds.maxX - artboardBounds.minX;
        var h = artboardBounds.maxY - artboardBounds.minY;
        this.transformContainer.style.width = Math.round(w) + "px";
        this.transformContainer.style.height = Math.round(h) + "px";
        // Backing-store pixels → CSS pixels. Measured rather than 1/dpr: a canvas can be
        // stretched by CSS, or have a stale backing store after a resize, and the drawn
        // content follows the CSS box either way. Equal to 1/dpr when they match.
        var cssWidth = this.lastCanvasPositioning.width;
        var cssHeight = this.lastCanvasPositioning.height;
        var fallback = 1 / (dpr || 1);
        var sx = this.canvas.width > 0 && cssWidth > 0 ? cssWidth / this.canvas.width : fallback;
        var sy = this.canvas.height > 0 && cssHeight > 0 ? cssHeight / this.canvas.height : fallback;
        var a = forwardMat.xx * sx;
        var b = forwardMat.xy * sy;
        var c = forwardMat.yx * sx;
        var d = forwardMat.yy * sy;
        var tx = forwardMat.tx * sx;
        var ty = forwardMat.ty * sy;
        this.transformContainer.style.transform =
            "matrix(".concat(a, ",").concat(b, ",").concat(c, ",").concat(d, ",").concat(tx, ",").concat(ty, ")");
    };
    return AccessibilityOverlay;
}());

// ---------------------------------------------------------------------------
// Static helpers (module-private)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// ARIA attribute eligibility — role sets
//
// Each set lists the Rive roles for which a given ARIA attribute is valid per
// WAI-ARIA 1.2 ("Used in roles" + "Inherits into roles"). The trait-gated
// blocks in applyAttributes check these before setting an attribute so that
// C++ nodes with unexpected trait combinations never produce invalid markup.
//
// To add a new role: append it to the relevant set(s) here — no other changes
// needed in applyAttributes.
// ---------------------------------------------------------------------------
/** aria-expanded: button, link, checkbox, switch (inherits button), tab. */
var ARIA_EXPANDED_ROLES = new Set([
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.button,
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.link,
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.checkbox,
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.switchControl,
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.tab,
]);
/**
 * aria-selected: tab is the only role in our current set that natively
 * supports it. Tab is also handled by an explicit unconditional branch in
 * applyAttributes (ARIA requires it there regardless of Selectable trait), but
 * the set still lists it so the constraint is visible in one place.
 */
var ARIA_SELECTED_ROLES = new Set([
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.tab,
]);
/** aria-checked: checkbox, radio, switch. */
var ARIA_CHECKED_ROLES = new Set([
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.checkbox,
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.radioButton,
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.switchControl,
]);
/**
 * aria-checked="mixed": checkbox only. ARIA defines checkbox as three-valued
 * (true/false/mixed) but radio and switch as two-valued (true/false), so an
 * indeterminate check state degrades to false for those roles rather than
 * emitting a value they do not support.
 */
var ARIA_MIXED_ROLES = new Set([
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.checkbox,
]);
/**
 * aria-pressed: button only. switch is a button subclass in ARIA but uses
 * aria-checked (not aria-pressed) for its on/off state — it is intentionally
 * excluded here and handled separately in the Toggleable block.
 */
var ARIA_PRESSED_ROLES = new Set([
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.button,
]);
/** aria-required: checkbox, textbox, radiogroup. */
var ARIA_REQUIRED_ROLES = new Set([
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.checkbox,
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.textField,
    _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.radioGroup,
]);
// ---------------------------------------------------------------------------
/** Style for visually-hidden description spans used with aria-describedby. */
var DESC_SPAN_STYLE = [
    "position:absolute",
    "width:1px",
    "height:1px",
    "overflow:hidden",
    "pointer-events:none",
    "left:-9999px",
].join(";");
var BASE_NODE_STYLE = [
    "position:absolute",
    "pointer-events:none",
    "box-sizing:border-box",
    "overflow:visible",
    "margin:0",
    "padding:0",
    "transform-origin: 0px 0px 0px",
    "border:none",
    "background:transparent",
    "color:transparent",
    // "list-style:none",
].join(";");
var SPAN_EXP = [
    "display:inline-block",
    "white-space:nowrap",
    "pointer-events:none",
].join(";");
/**
 * Attribute writers that skip same-value mutations. Even a no-op setAttribute
 * fires a mutation record, and whether AX layers dedupe those is
 * browser-specific — skipping the write is the only browser-proof guard.
 */
function setAttr(el, attr, value) {
    if (el.getAttribute(attr) !== value)
        el.setAttribute(attr, value);
}
function removeAttr(el, attr) {
    if (el.hasAttribute(attr))
        el.removeAttribute(attr);
}
function setBoolAttr(el, attr, value) {
    setAttr(el, attr, value ? "true" : "false");
}
/** Roles that receive click/Enter/Space action handlers. */
function isClickableRole(role) {
    switch (role) {
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.button:
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.link:
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.checkbox:
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.switchControl:
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.tab:
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.radioButton:
            return true;
        default:
            return false;
    }
}
/** Roles that receive tabindex="-1" for programmatic/AT focus (not Tab order). */
function isInteractiveRole(role) {
    switch (role) {
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.button:
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.link:
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.checkbox:
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.switchControl:
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.slider:
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.tab:
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.radioButton:
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.textField:
            return true;
        default:
            return false;
    }
}
/**
 * A modal/alert dialog: alertDialog is always modal per WAI-ARIA, a plain
 * dialog only when the Modal state flag is set.
 */
function isModalDialogRole(role, flags) {
    return (role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.alertDialog ||
        (role === _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.dialog && (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasState)(flags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticState.Modal)));
}
/** Whether a node can receive focus: an interactive role or the Focusable trait. */
function isFocusableNode(node) {
    return (isInteractiveRole(node.role) ||
        (0,_types__WEBPACK_IMPORTED_MODULE_2__.hasTrait)(node.traitFlags, _types__WEBPACK_IMPORTED_MODULE_2__.SemanticTrait.Focusable));
}
/**
 * Choose an HTML tag for a given role. Prefer native semantic elements
 * where they exist — screen readers treat them more reliably than
 * generic elements with ARIA role overrides.
 */
function tagForRole(role) {
    switch (role) {
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.link:
            return "a";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.text:
            // The outer div is the positioned AX element VoiceOver measures for its
            // highlight box. The text itself lives in a child <span> (see createElement).
            return "div";
        default:
            return "div";
    }
}
/**
 * Maps a Rive SemanticRole to an ARIA `role` attribute value.
 * Returns null for roles that don't need an explicit role attribute here
 * (e.g. text nodes use an outer div + inner span with textContent; heading
 * role is applied separately when headingLevel > 0).
 */
function ariaRoleForSemantic(role) {
    switch (role) {
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.none:
            // TODO: Role "none" removes the node from the accessibility tree. For now, setting to Group, but maybe we want to switch to "none"
            // or "presentation".
            return "group";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.button:
            return "button";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.link:
            return null; // native <a>
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.checkbox:
            return "checkbox";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.switchControl:
            return "switch";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.slider:
            return "slider";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.textField:
            return "textbox";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.image:
            return "img";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.group:
            return "group";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.list:
            return "list";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.listItem:
            return "listitem";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.tab:
            return "tab";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.tabList:
            return "tablist";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.dialog:
            return "dialog";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.alertDialog:
            return "alertdialog";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.radioGroup:
            return "radiogroup";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.radioButton:
            return "radio";
        case _types__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.text:
            // Text nodes use <span>; heading role is applied separately
            // when headingLevel > 0.
            return null;
        default:
            return null;
    }
}


/***/ }),
/* 10 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   claimKeyEvent: () => (/* binding */ claimKeyEvent),
/* harmony export */   isKeyEventClaimed: () => (/* binding */ isKeyEventClaimed)
/* harmony export */ });
var claimed = new WeakSet();
/**
 * Marks a key event as handled by a semantic overlay widget (and prevents its
 * default), so the Rive keyboard handler leaves it alone. A plain
 * `defaultPrevented` check can't tell these apart from host-page handlers.
 */
function claimKeyEvent(event) {
    event.preventDefault();
    claimed.add(event);
}
function isKeyEventClaimed(event) {
    return claimed.has(event);
}


/***/ }),
/* 11 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   canvasOffset: () => (/* binding */ canvasOffset)
/* harmony export */ });
/**
 * Canvas offset within its offsetParent, minus the scroll of ancestors in between (they
 * move the canvas, not absolutely positioned siblings).
 */
function canvasOffset(canvas) {
    var top = canvas.offsetTop;
    var left = canvas.offsetLeft;
    var offsetParent = canvas.offsetParent;
    if (!offsetParent)
        return { top: top, left: left };
    for (var el = canvas.parentElement; el && el !== offsetParent; el = el.parentElement) {
        top -= el.scrollTop;
        left -= el.scrollLeft;
    }
    return { top: top, left: left };
}


/***/ }),
/* 12 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AudioAssetWrapper: () => (/* reexport safe */ _finalizationRegistry__WEBPACK_IMPORTED_MODULE_3__.AudioAssetWrapper),
/* harmony export */   AudioWrapper: () => (/* reexport safe */ _finalizationRegistry__WEBPACK_IMPORTED_MODULE_3__.AudioWrapper),
/* harmony export */   BLANK_URL: () => (/* reexport safe */ _sanitizeUrl__WEBPACK_IMPORTED_MODULE_2__.BLANK_URL),
/* harmony export */   CustomFileAssetLoaderWrapper: () => (/* reexport safe */ _finalizationRegistry__WEBPACK_IMPORTED_MODULE_3__.CustomFileAssetLoaderWrapper),
/* harmony export */   FileAssetWrapper: () => (/* reexport safe */ _finalizationRegistry__WEBPACK_IMPORTED_MODULE_3__.FileAssetWrapper),
/* harmony export */   FileFinalizer: () => (/* reexport safe */ _finalizationRegistry__WEBPACK_IMPORTED_MODULE_3__.FileFinalizer),
/* harmony export */   FocusSessionState: () => (/* reexport safe */ _registerKeyboardInteractions__WEBPACK_IMPORTED_MODULE_1__.FocusSessionState),
/* harmony export */   FontAssetWrapper: () => (/* reexport safe */ _finalizationRegistry__WEBPACK_IMPORTED_MODULE_3__.FontAssetWrapper),
/* harmony export */   FontWrapper: () => (/* reexport safe */ _finalizationRegistry__WEBPACK_IMPORTED_MODULE_3__.FontWrapper),
/* harmony export */   ImageAssetWrapper: () => (/* reexport safe */ _finalizationRegistry__WEBPACK_IMPORTED_MODULE_3__.ImageAssetWrapper),
/* harmony export */   ImageWrapper: () => (/* reexport safe */ _finalizationRegistry__WEBPACK_IMPORTED_MODULE_3__.ImageWrapper),
/* harmony export */   KeyboardInteractions: () => (/* reexport safe */ _registerKeyboardInteractions__WEBPACK_IMPORTED_MODULE_1__.KeyboardInteractions),
/* harmony export */   RiveFont: () => (/* reexport safe */ _riveFont__WEBPACK_IMPORTED_MODULE_4__.RiveFont),
/* harmony export */   createFinalization: () => (/* reexport safe */ _finalizationRegistry__WEBPACK_IMPORTED_MODULE_3__.createFinalization),
/* harmony export */   finalizationRegistry: () => (/* reexport safe */ _finalizationRegistry__WEBPACK_IMPORTED_MODULE_3__.finalizationRegistry),
/* harmony export */   registerTouchInteractions: () => (/* reexport safe */ _registerTouchInteractions__WEBPACK_IMPORTED_MODULE_0__.registerTouchInteractions),
/* harmony export */   sanitizeUrl: () => (/* reexport safe */ _sanitizeUrl__WEBPACK_IMPORTED_MODULE_2__.sanitizeUrl)
/* harmony export */ });
/* harmony import */ var _registerTouchInteractions__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(13);
/* harmony import */ var _registerKeyboardInteractions__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(14);
/* harmony import */ var _sanitizeUrl__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(17);
/* harmony import */ var _finalizationRegistry__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(18);
/* harmony import */ var _riveFont__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(19);







/***/ }),
/* 13 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   registerTouchInteractions: () => (/* binding */ registerTouchInteractions)
/* harmony export */ });
var _this = undefined;
// A detented wheel reports lines; the runtime wants pixels.
var PIXELS_PER_LINE = 16;
// ScrollPhase.update. The DOM reports no gesture phase, so every wheel event
// is an update and the runtime closes the gesture once it goes quiet.
var SCROLL_PHASE_UPDATE = 1;
/**
 * Touch state per canvas. It outlives a single registration, because Rive
 * re-registers the listeners (on play and pause) while a finger can still be
 * down.
 */
var touchStateByCanvas = new WeakMap();
/**
 * Extracts ClientCoordinates from a TouchList, respecting multi-touch vs.
 * single-touch mode. In single-touch mode, only the touch matching
 * primaryTouchId is returned (or the first touch when primaryTouchId is null).
 */
var getTouchCoordinates = function (changedTouches, enableMultiTouch, primaryTouchId) {
    var _a;
    var coordinates = [];
    if (enableMultiTouch) {
        for (var i = 0; i < changedTouches.length; i++) {
            var touch = changedTouches[i];
            coordinates.push({
                clientX: touch.clientX,
                clientY: touch.clientY,
                identifier: touch.identifier,
            });
        }
    }
    else {
        // In "single-touch mode", only track the primary finger identified at touchstart.
        // Search changedTouches for the touch matching the recorded primary touch identifier, or (on initial touchstart)
        // take the first available touch identifier.
        var primaryTouch = primaryTouchId !== null
            ? (_a = Array.from(changedTouches).find(function (t) { return t.identifier === primaryTouchId; })) !== null && _a !== void 0 ? _a : null
            : changedTouches[0];
        if (primaryTouch) {
            coordinates.push({
                clientX: primaryTouch.clientX,
                clientY: primaryTouch.clientY,
                identifier: primaryTouch.identifier,
            });
        }
    }
    return coordinates;
};
/**
 * Returns the clientX and clientY properties from touch or mouse events. Also
 * calls preventDefault() on the event if it is a touchstart or touchmove to prevent
 * scrolling the page on mobile devices
 * @param event - Either a TouchEvent or a MouseEvent
 * @param isTouchScrollEnabled - Whether touch scrolling is enabled
 * @param enableMultiTouch - Whether to process multiple simultaneous touches
 * @param primaryTouchId - When working with single touches, only process the touch
 *   with this identifier. Pass null to accept any touch (used during touchstart to
 *   capture the first finger down).
 * @returns - Coordinates of the clientX and clientY properties from the touch/mouse event
 */
var getClientCoordinates = function (event, isTouchScrollEnabled, enableMultiTouch, primaryTouchId) {
    var _a;
    var touchEvent = event;
    if ((_a = touchEvent.changedTouches) === null || _a === void 0 ? void 0 : _a.length) {
        // This flag, if false, prevents touch events on the canvas default behavior
        // which may prevent scrolling if a drag motion on the canvas is performed
        if (!isTouchScrollEnabled && ["touchstart", "touchmove"].includes(event.type)) {
            event.preventDefault();
        }
        return getTouchCoordinates(touchEvent.changedTouches, enableMultiTouch, primaryTouchId);
    }
    return [
        {
            clientX: event.clientX,
            clientY: event.clientY,
            identifier: 0,
        },
    ];
};
/**
 * Registers mouse move/up/down and wheel callback handlers on the canvas to send meaningful
 * coordinates to the state machine pointer move/up/down/scroll functions based on cursor
 * interaction
 */
var registerTouchInteractions = function (_a) {
    var _b;
    var canvas = _a.canvas, artboard = _a.artboard, _c = _a.stateMachines, stateMachines = _c === void 0 ? [] : _c, renderer = _a.renderer, rive = _a.rive, fit = _a.fit, alignment = _a.alignment, _d = _a.isTouchScrollEnabled, isTouchScrollEnabled = _d === void 0 ? false : _d, _e = _a.dispatchPointerExit, dispatchPointerExit = _e === void 0 ? true : _e, _f = _a.enableMultiTouch, enableMultiTouch = _f === void 0 ? false : _f, _g = _a.layoutScaleFactor, layoutScaleFactor = _g === void 0 ? 1.0 : _g, advanceAndDrain = _a.advanceAndDrain, summonKeyboard = _a.summonKeyboard, isTextProxyFocused = _a.isTextProxyFocused;
    if (!canvas ||
        !stateMachines.length ||
        !renderer ||
        !rive ||
        !artboard ||
        typeof window === "undefined") {
        return null;
    }
    // A gesture latched before the previous listeners came down (a pause, say)
    // never reached its idle timeout, and would take the next wheel wherever
    // it lands. These instances are live here; at teardown they may not be.
    for (var _i = 0, stateMachines_1 = stateMachines; _i < stateMachines_1.length; _i++) {
        var stateMachine = stateMachines_1[_i];
        stateMachine.cancelScroll();
    }
    /**
     * After a touchend event, some browsers may fire synthetic mouse events
     * (mouseover, mousedown, mousemove, mouseup) if the touch interaction did not cause
     * any default action (such as scrolling).
     *
     * This is done to simulate the behavior of a mouse for applications that do not support
     * touch events.
     *
     * We're keeping track of the previous event to not send the synthetic mouse events if the
     * touch event was a click (touchstart -> touchend).
     *
     * Emulated events only occur when `isTouchScrollEnabled` is true; when false,
     * touchstart is default-prevented, which suppresses them.
     * Emulated mousedown is prevented while the proxy is focused, or it would blur it and
     * drop the keyboard.
     **/
    var _prevEventType = null;
    var _syntheticEventsActive = false;
    /**
     * primaryTouchId: when enableMultiTouch is false ("single-touch mode"),
     * we track the identifier of the first finger that touched down. All
     * subsequent touch events are filtered to this identifier so that a second
     * finger moving cannot displace the tracked pointer position. Reset to null
     * when the primary finger lifts (or touchcancel is called).
     *
     * touches: a cancel may report no position, or none at all for some
     * touches, so it ends them where they were last seen.
     */
    var _touchState = (_b = touchStateByCanvas.get(canvas)) !== null && _b !== void 0 ? _b : {
        touches: new Map(),
        primaryTouchId: null,
    };
    touchStateByCanvas.set(canvas, _touchState);
    var _activeTouches = _touchState.touches;
    /**
     * A finger can lift while no listeners are registered (after stop(), say),
     * so its touchend never arrives. A touchstart or touchmove lists every
     * finger still down in `touches`; forget the rest.
     */
    var forgetLiftedTouches = function (_a) {
        var _b;
        var touches = _a.touches, changedTouches = _a.changedTouches;
        if (!touches) {
            return;
        }
        var down = new Set();
        for (var i = 0; i < touches.length; i++) {
            down.add(touches[i].identifier);
        }
        for (var i = 0; i < ((_b = changedTouches === null || changedTouches === void 0 ? void 0 : changedTouches.length) !== null && _b !== void 0 ? _b : 0); i++) {
            down.add(changedTouches[i].identifier);
        }
        _activeTouches.forEach(function (_, identifier) {
            if (!down.has(identifier)) {
                _activeTouches.delete(identifier);
            }
        });
        if (_touchState.primaryTouchId !== null &&
            !down.has(_touchState.primaryTouchId)) {
            _touchState.primaryTouchId = null;
        }
    };
    /**
     * Maps client-space points into Artboard space through the fit and alignment
     * of the canvas.
     */
    var mapToArtboard = function (boundingRect, points) {
        var forwardMatrix = rive.computeAlignment(fit, alignment, {
            minX: 0,
            minY: 0,
            maxX: boundingRect.width,
            maxY: boundingRect.height,
        }, artboard.bounds, layoutScaleFactor);
        var invertedMatrix = new rive.Mat2D();
        forwardMatrix.invert(invertedMatrix);
        var mapped = points.map(function (_a) {
            var clientX = _a.clientX, clientY = _a.clientY;
            var canvasX = clientX - boundingRect.left;
            var canvasY = clientY - boundingRect.top;
            var canvasCoordinatesVector = new rive.Vec2D(canvasX, canvasY);
            var transformedVector = rive.mapXY(invertedMatrix, canvasCoordinatesVector);
            var point = { x: transformedVector.x(), y: transformedVector.y() };
            transformedVector.delete();
            canvasCoordinatesVector.delete();
            return point;
        });
        invertedMatrix.delete();
        forwardMatrix.delete();
        return mapped;
    };
    var processEventCallback = function (event) {
        var _a, _b;
        // Exit early out of all synthetic mouse events
        // https://stackoverflow.com/questions/9656990/how-to-prevent-simulated-mouse-events-in-mobile-browsers
        // https://stackoverflow.com/questions/25572070/javascript-touchend-versus-click-dilemma
        if (_syntheticEventsActive && event instanceof MouseEvent) {
            if (event.type === "mousedown" && (isTextProxyFocused === null || isTextProxyFocused === void 0 ? void 0 : isTextProxyFocused())) {
                event.preventDefault();
            }
            // Synthetic event finished
            if (event.type == "mouseup") {
                _syntheticEventsActive = false;
            }
            return;
        }
        // Test if it's a "touch click". This could cause the browser to send
        // synthetic mouse events.
        _syntheticEventsActive =
            isTouchScrollEnabled &&
                event.type === "touchend" &&
                _prevEventType === "touchstart";
        _prevEventType = event.type;
        var boundingRect = event.currentTarget.getBoundingClientRect();
        if (event.type === "touchstart" || event.type === "touchmove") {
            forgetLiftedTouches(event);
        }
        // On touchstart in single-touch mode, record the first new finger as the primary
        // touch if we aren't already tracking one.
        if (!enableMultiTouch && event.type === "touchstart" && _touchState.primaryTouchId === null) {
            var firstTouch = (_a = event.changedTouches) === null || _a === void 0 ? void 0 : _a[0];
            if (firstTouch) {
                _touchState.primaryTouchId = firstTouch.identifier;
            }
        }
        var coordinateSets = getClientCoordinates(event, isTouchScrollEnabled, enableMultiTouch, enableMultiTouch ? null : _touchState.primaryTouchId);
        var positionedSets = coordinateSets.filter(function (coordinateSet) { return coordinateSet.clientX || coordinateSet.clientY; });
        mapToArtboard(boundingRect, positionedSets).forEach(function (point, i) {
            positionedSets[i].transformedX = point.x;
            positionedSets[i].transformedY = point.y;
        });
        // Only a touchstart the scene saw starts tracking a touch, so a finger
        // that single-touch mode ignored can never be ended by a cancel. Any
        // finger that lifts stops being tracked, whether or not the scene saw it.
        if (event.type === "touchend") {
            var lifted = (_b = event.changedTouches) !== null && _b !== void 0 ? _b : [];
            for (var i = 0; i < lifted.length; i++) {
                _activeTouches.delete(lifted[i].identifier);
            }
        }
        else if (event.type === "touchstart" || event.type === "touchmove") {
            coordinateSets.forEach(function (_a) {
                var clientX = _a.clientX, clientY = _a.clientY, identifier = _a.identifier;
                var tracked = _activeTouches.has(identifier);
                if (event.type === "touchstart" && !tracked) {
                    _activeTouches.set(identifier, { clientX: clientX, clientY: clientY });
                }
                else if (tracked && (clientX || clientY)) {
                    _activeTouches.set(identifier, { clientX: clientX, clientY: clientY });
                }
            });
        }
        switch (event.type) {
            /**
             * There's a 2px buffer for a hitRadius when translating the pointer coordinates
             * down to the state machine. In cases where the hitbox is about that much away
             * from the Artboard border, we don't have exact precision on determining pointer
             * exit. We're therefore adding to the translated coordinates on mouseout of a canvas
             * to ensure that we report the mouse has truly exited the hitarea.
             * https://github.com/rive-app/rive-cpp/blob/master/src/animation/state_machine_instance.cpp#L336
             *
             */
            case "mouseout":
                var _loop_1 = function (stateMachine) {
                    if (dispatchPointerExit) {
                        coordinateSets.forEach(function (coordinateSet) {
                            stateMachine.pointerExit(coordinateSet.transformedX, coordinateSet.transformedY, coordinateSet.identifier);
                        });
                    }
                    else {
                        coordinateSets.forEach(function (coordinateSet) {
                            stateMachine.pointerMove(coordinateSet.transformedX, coordinateSet.transformedY, coordinateSet.identifier);
                        });
                    }
                };
                for (var _i = 0, stateMachines_2 = stateMachines; _i < stateMachines_2.length; _i++) {
                    var stateMachine = stateMachines_2[_i];
                    _loop_1(stateMachine);
                }
                break;
            // Pointer moving/hovering on the canvas
            case "touchmove":
            case "mouseover":
            case "mousemove": {
                var _loop_2 = function (stateMachine) {
                    coordinateSets.forEach(function (coordinateSet) {
                        stateMachine.pointerMove(coordinateSet.transformedX, coordinateSet.transformedY, coordinateSet.identifier);
                    });
                };
                for (var _c = 0, stateMachines_3 = stateMachines; _c < stateMachines_3.length; _c++) {
                    var stateMachine = stateMachines_3[_c];
                    _loop_2(stateMachine);
                }
                break;
            }
            // Pointer click initiated but not released yet on the canvas
            case "touchstart":
            case "mousedown": {
                var _loop_3 = function (stateMachine) {
                    coordinateSets.forEach(function (coordinateSet) {
                        stateMachine.pointerDown(coordinateSet.transformedX, coordinateSet.transformedY, coordinateSet.identifier);
                    });
                };
                for (var _d = 0, stateMachines_4 = stateMachines; _d < stateMachines_4.length; _d++) {
                    var stateMachine = stateMachines_4[_d];
                    _loop_3(stateMachine);
                }
                // Advance the state machine immediately so pointer down(s) takes effect synchronously
                advanceAndDrain(0, { pointerDown: true });
                break;
            }
            // Pointer click released on the canvas
            case "touchend": {
                var _loop_4 = function (stateMachine) {
                    coordinateSets.forEach(function (coordinateSet) {
                        stateMachine.pointerUp(coordinateSet.transformedX, coordinateSet.transformedY, coordinateSet.identifier);
                        stateMachine.pointerExit(coordinateSet.transformedX, coordinateSet.transformedY, coordinateSet.identifier);
                    });
                };
                for (var _e = 0, stateMachines_5 = stateMachines; _e < stateMachines_5.length; _e++) {
                    var stateMachine = stateMachines_5[_e];
                    _loop_4(stateMachine);
                }
                // Advance the state machine immediately so pointer up(s) takes effect synchronously
                advanceAndDrain(0);
                // Still inside the touch gesture — summon the keyboard if the tap focused a
                // text input
                summonKeyboard === null || summonKeyboard === void 0 ? void 0 : summonKeyboard();
                // Release the primary touch lock once that finger lifts so the next
                // touchstart can claim a new primary finger.
                if (!enableMultiTouch &&
                    coordinateSets.some(function (c) { return c.identifier === _touchState.primaryTouchId; })) {
                    _touchState.primaryTouchId = null;
                }
                break;
            }
            case "mouseup": {
                var _loop_5 = function (stateMachine) {
                    coordinateSets.forEach(function (coordinateSet) {
                        stateMachine.pointerUp(coordinateSet.transformedX, coordinateSet.transformedY, coordinateSet.identifier);
                    });
                };
                for (var _f = 0, stateMachines_6 = stateMachines; _f < stateMachines_6.length; _f++) {
                    var stateMachine = stateMachines_6[_f];
                    _loop_5(stateMachine);
                }
                // Advance the state machine immediately so pointer up(s) takes effect synchronously
                advanceAndDrain(0);
                summonKeyboard === null || summonKeyboard === void 0 ? void 0 : summonKeyboard();
                break;
            }
            default:
        }
    };
    /**
     * The browser cancels a touch when the system takes the gesture: a home
     * indicator or edge swipe, an app switch, an alert. Each cancelled touch
     * gets pointerUp then pointerExit, like a lifted finger, so anything
     * waiting for the release doesn't stay pressed. It skips the tap-only side
     * effects (keyboard, emulated mouse events). A page scroll does not cancel
     * the touch in iOS Safari or Android Chrome (it ends with a touchend), so
     * this holds with touch scrolling enabled too.
     */
    var touchCancelCallback = function (event) {
        var _a, _b;
        var cancelled = new Set();
        var changedTouches = (_a = event.changedTouches) !== null && _a !== void 0 ? _a : [];
        for (var i = 0; i < changedTouches.length; i++) {
            var _c = changedTouches[i], identifier = _c.identifier, clientX = _c.clientX, clientY = _c.clientY;
            // Touches the scene never saw (a secondary finger in single-touch
            // mode, or one that already ended) are not tracked.
            if (!_activeTouches.has(identifier)) {
                continue;
            }
            cancelled.add(identifier);
            if (clientX || clientY) {
                _activeTouches.set(identifier, { clientX: clientX, clientY: clientY });
            }
        }
        // A cancel can name only some of the touches, or none. `touches` lists
        // every finger still down, so end any tracked touch missing from it.
        var down = new Set();
        var touches = (_b = event.touches) !== null && _b !== void 0 ? _b : [];
        for (var i = 0; i < touches.length; i++) {
            down.add(touches[i].identifier);
        }
        _activeTouches.forEach(function (_, identifier) {
            if (!down.has(identifier)) {
                cancelled.add(identifier);
            }
        });
        if (_touchState.primaryTouchId === null ||
            cancelled.has(_touchState.primaryTouchId)) {
            _touchState.primaryTouchId = null;
        }
        if (!cancelled.size) {
            return;
        }
        var identifiers = Array.from(cancelled);
        var points = mapToArtboard(event.currentTarget.getBoundingClientRect(), identifiers.map(function (identifier) { return _activeTouches.get(identifier); }));
        identifiers.forEach(function (identifier) { return _activeTouches.delete(identifier); });
        var _loop_6 = function (stateMachine) {
            identifiers.forEach(function (identifier, i) {
                var _a = points[i], x = _a.x, y = _a.y;
                stateMachine.pointerUp(x, y, identifier);
                stateMachine.pointerExit(x, y, identifier);
            });
        };
        for (var _i = 0, stateMachines_7 = stateMachines; _i < stateMachines_7.length; _i++) {
            var stateMachine = stateMachines_7[_i];
            _loop_6(stateMachine);
        }
        // Advance immediately so the release takes effect synchronously
        advanceAndDrain(0);
    };
    /**
     * Forwards wheel and trackpad scrolling to the state machines. The page keeps
     * the wheel unless a scroll view actually moves, so it still scrolls when
     * Rive has nothing to scroll or a view sits at its edge.
     */
    var wheelCallback = function (event) {
        // Pinch zoom arrives as a ctrl+wheel and belongs to the page. A wheel that
        // can't be cancelled is part of a sequence the page is already scrolling;
        // taking it too would move both.
        if (event.ctrlKey || !event.cancelable) {
            return;
        }
        // Read before the deltas: Firefox reports pixels once a delta has been
        // read first.
        var deltaMode = event.deltaMode;
        var deltaX = event.deltaX;
        var deltaY = event.deltaY;
        // Shift+wheel scrolls sideways. Most browsers already report it on the x
        // axis; a vertical-only view would decline it on y.
        if (event.shiftKey && !deltaX) {
            deltaX = deltaY;
            deltaY = 0;
        }
        var boundingRect = event.currentTarget.getBoundingClientRect();
        // A page is the canvas's visible size, the nearest the host can get to the
        // scroll view's own.
        var toPixelsX = deltaMode === WheelEvent.DOM_DELTA_LINE
            ? PIXELS_PER_LINE
            : deltaMode === WheelEvent.DOM_DELTA_PAGE
                ? boundingRect.width
                : 1;
        var toPixelsY = deltaMode === WheelEvent.DOM_DELTA_LINE
            ? PIXELS_PER_LINE
            : deltaMode === WheelEvent.DOM_DELTA_PAGE
                ? boundingRect.height
                : 1;
        // The DOM reports how far to scroll; the runtime wants how far content
        // travels.
        var scrollX = -deltaX * toPixelsX;
        var scrollY = -deltaY * toPixelsY;
        if (!scrollX && !scrollY) {
            return;
        }
        // Mapping both ends of the delta keeps only the scale of the fit.
        var _a = mapToArtboard(boundingRect, [
            { clientX: event.clientX, clientY: event.clientY },
            { clientX: event.clientX + scrollX, clientY: event.clientY + scrollY },
        ]), position = _a[0], moved = _a[1];
        // The DOM never says whether a pixel delta came from a trackpad, so it
        // counts as precise either way, as it does in the browser's own scrolling.
        var precise = deltaMode === WheelEvent.DOM_DELTA_PIXEL;
        var timeStamp = event.timeStamp / 1000;
        // A latched state machine owns the rest of its gesture, even past its edge.
        var latched = stateMachines.filter(function (sm) { return sm.hasScrollLatch(); });
        var ordered = latched.concat(stateMachines.filter(function (sm) { return latched.indexOf(sm) === -1; }));
        var consumed = ordered.some(function (stateMachine) {
            return stateMachine.pointerScroll(position.x, position.y, moved.x - position.x, moved.y - position.y, SCROLL_PHASE_UPDATE, precise, timeStamp, 0) !== 0;
        });
        if (!consumed) {
            return;
        }
        event.preventDefault();
        // Advance now so the scroll lands on the next frame drawn.
        advanceAndDrain(0);
    };
    var callback = processEventCallback.bind(_this);
    canvas.addEventListener("mouseover", callback);
    canvas.addEventListener("mouseout", callback);
    canvas.addEventListener("mousemove", callback);
    canvas.addEventListener("mousedown", callback);
    canvas.addEventListener("mouseup", callback);
    canvas.addEventListener("touchmove", callback, {
        passive: isTouchScrollEnabled,
    });
    canvas.addEventListener("touchstart", callback, {
        passive: isTouchScrollEnabled,
    });
    canvas.addEventListener("touchend", callback);
    canvas.addEventListener("touchcancel", touchCancelCallback);
    // Not passive, or preventDefault could not keep the page from scrolling.
    canvas.addEventListener("wheel", wheelCallback, { passive: false });
    return function () {
        canvas.removeEventListener("mouseover", callback);
        canvas.removeEventListener("mouseout", callback);
        canvas.removeEventListener("mousemove", callback);
        canvas.removeEventListener("mousedown", callback);
        canvas.removeEventListener("mouseup", callback);
        canvas.removeEventListener("touchmove", callback);
        canvas.removeEventListener("touchstart", callback);
        canvas.removeEventListener("touchend", callback);
        canvas.removeEventListener("touchcancel", touchCancelCallback);
        canvas.removeEventListener("wheel", wheelCallback);
    };
};


/***/ }),
/* 14 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FocusSessionState: () => (/* binding */ FocusSessionState),
/* harmony export */   KeyboardInteractions: () => (/* binding */ KeyboardInteractions)
/* harmony export */ });
/* harmony import */ var _keyMap__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(15);
/* harmony import */ var _semantics_claimedKeyEvents__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(10);
/* harmony import */ var _textInputProxy__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(16);



/**
 * Defaults suppressed while typing (scroll/navigate/submit). Tab is traversal's; proxy
 * Space returns earlier as a printable.
 */
var EDITING_NAV_CODES = new Set([
    "Space",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Backspace",
    "Delete",
    "Home",
    "End",
    "Enter",
    "NumpadEnter",
]);
/** A keystroke that types a character (not a Ctrl/Cmd shortcut). */
function isPrintable(event) {
    return event.key.length === 1 && !event.ctrlKey && !event.metaKey;
}
function isArrowKey(key) {
    return (key === _keyMap__WEBPACK_IMPORTED_MODULE_0__.Key.left || key === _keyMap__WEBPACK_IMPORTED_MODULE_0__.Key.right || key === _keyMap__WEBPACK_IMPORTED_MODULE_0__.Key.up || key === _keyMap__WEBPACK_IMPORTED_MODULE_0__.Key.down);
}
/**
 * Alt/Ctrl/Meta arrows are browser/OS shortcuts (Alt+Left = back, Cmd+Arrow, etc.).
 * Shift is allowed: it is the spatial-navigation chord in Vivaldi/Opera.
 */
function hasShortcutModifier(event) {
    return event.altKey || event.ctrlKey || event.metaKey;
}
/**
 * Tracks the relationship between DOM focus inside this Rive focus domain (canvas or semantic overlay)
 * and Rive's internal focus for the current focus session.
 *
 * NotFocused   — DOM focus left the domain, Rive released focus internally, or Tab walked
 *                off the end of the tree. Keyboard input isn't ours, so Tab is ignored and
 *                reaches the next page element.
 * EntryPending — DOM focus is inside the domain but Rive holds no node yet, so the next Tab
 *                enters the focus tree. Set by pointer focus on the canvas, by assistive technology (AT) focus landing
 *                in the overlay, and by keyboard focus whose entry attempt found no eligible node.
 * RiveFocused  — a Rive node holds focus. Tab/Shift+Tab route to the Rive focus manager and stay
 *                inside the domain until either Rive reports focus ended (pollFocusState) or
 *                Tab walks off the edge of the tree (focusNext()/focusPrevious() returns false and
 *                Rive no longer holds focus).
 *
 * Keyboard focus on the canvas enters the tree immediately: onCanvasFocus infers direction from
 * where focus came from and goes straight to RiveFocused when a node accepts.
 */
var FocusSessionState;
(function (FocusSessionState) {
    FocusSessionState["NotFocused"] = "notFocused";
    FocusSessionState["EntryPending"] = "entryPending";
    FocusSessionState["RiveFocused"] = "riveFocused";
})(FocusSessionState || (FocusSessionState = {}));
/**
 * Manages keyboard and DOM focus interactions for Rive's focus domain (<canvas>, semantic
 * overlay, text input proxy). Owns the proxy and the text input session state.
 * Because keyboard events can apply on either part of the domain, we need to track what events we should
 * handle/intercept, and when to release focus back to the page outside of the domain.
 *
 * Tracks the canvas focus session state (focusSessionState) and routes
 * Tab/Shift+Tab to the Rive state machine's focus manager. Exposes shared
 * state as properties so the Rive render loop can read them directly.
 */
var KeyboardInteractions = /** @class */ (function () {
    function KeyboardInteractions(_a) {
        var canvas = _a.canvas, stateMachine = _a.stateMachine, hasFocusNodes = _a.hasFocusNodes, getOverlayElement = _a.getOverlayElement;
        var _this = this;
        var _b, _c;
        this.focusSessionState = FocusSessionState.NotFocused;
        /** Whether the canvas currently has browser DOM focus. */
        this.canvasHasFocus = false;
        /** After Tab exits the last Rive node, ignore keydowns until focus re-enters the focus domain. */
        this.focusDomainReleased = false;
        /** Overlay element currently wired with focusin/keydown listeners, if any. */
        this.currentOverlayElement = null;
        /** Codes whose keydown an overlay widget took, so their keyup is skipped too. */
        this.claimedKeyCodes = new Set();
        this.textInputSessionActive = false;
        /**
         * The proxy is always empty: copy Rive's selection; always preventDefault.
         */
        this.onCopy = function (event) {
            var _a;
            event.preventDefault();
            var selected = _this.mainSm.selectedText();
            if (selected)
                (_a = event.clipboardData) === null || _a === void 0 ? void 0 : _a.setData("text/plain", selected);
        };
        /**
         * Handles the canvas gaining browser focus. The behavior differs based on how focus was gained -
         *
         * Pointer-driven focus: the canvas now has focus but Rive holds nothing yet, so we move to EntryPending — this lets the
         * next Tab enter the focus tree even when the focus is pointer-driven
         *
         * Keyboard-driven focus: we enter the Rive focus tree immediately once canvas gains focus.
         * The direction is inferred from where focus came from: an element before the canvas in DOM order
         * means a forward Tab (focusNext), one after means a Shift+Tab (focusPrevious). :focus-visible
         * gates this so a click doesn't yank Rive focus to the first node on the focus event itself.
         */
        this.onCanvasFocus = function (event) {
            _this.syncOverlayListener();
            _this.canvasHasFocus = true;
            _this.focusDomainReleased = false;
            if (_this.isInFocusDomain(event.relatedTarget) ||
                !_this.hasFocusNodes ||
                _this.mainSm.focusState().hasFocus) {
                return;
            }
            _this.focusSessionState = FocusSessionState.EntryPending;
            // Pointer focus waits for the user's next Tab (handled in onKeyDown). Keyboard focus enters now.
            if (!_this.isKeyboardDrivenFocus())
                return;
            var forward = _this.cameFromBeforeCanvas(event.relatedTarget);
            if (forward ? _this.mainSm.focusNext() : _this.mainSm.focusPrevious()) {
                _this.focusSessionState = FocusSessionState.RiveFocused;
            }
        };
        /**
         * Marks internal state that the canvas has lost DOM focus. Do not actually clear
         * Rive focus though if:
         * 1. DOM focus is still within Rive domain (i.e., semantic overlay)
         * 2. Document just lost focus (i.e. tab switching)
         *
         * When we're not in either of those buckets, it's safe to call `clearFocus()` on the SMI.
         */
        this.onCanvasBlur = function (event) {
            // Must stay before the state reset because beginTextInputSession sets the session state and
            // then focuses the proxy, which synchronously blurs the canvas.
            if (_this.inputProxy.owns(event.relatedTarget))
                return;
            _this.focusSessionState = FocusSessionState.NotFocused;
            _this.canvasHasFocus = false;
            if (_this.blurStaysWithRive(event.relatedTarget))
                return;
            _this.mainSm.clearFocus();
        };
        /**
         * Assistive technology (AT) focus landing inside the overlay is DOM focus inside the Rive focus domain, so open a
         * session even when no Rive node holds focus yet. shouldRiveHandleKeyEvent treats NotFocused
         * as authoritative, so without this the overlay's Tab keydowns reach onKeyDown and get dropped
         * at that gate — the browser would move focus out of Rive instead of to the next focus node.
         */
        this.onOverlayFocusIn = function (event) {
            if (!_this.isInOverlay(event.target))
                return;
            _this.focusDomainReleased = false;
            if (!_this.hasFocusNodes)
                return;
            if (_this.focusSessionState !== FocusSessionState.NotFocused)
                return;
            _this.focusSessionState = _this.mainSm.focusState().hasFocus
                ? FocusSessionState.RiveFocused
                : FocusSessionState.EntryPending;
        };
        /** Overlay listeners attach lazily, so the first focusin only ever lands here. */
        this.onFocusDomainHostFocusIn = function (event) {
            _this.syncOverlayListener();
            _this.onOverlayFocusIn(event);
            // Focus entering the proxy re-enters the focus domain, so clear any earlier Tab-out
            // release, or onKeyDown would drop the session's keystrokes.
            if (_this.inputProxy.owns(event.target)) {
                _this.focusDomainReleased = false;
            }
        };
        /**
         * Handles keydown events in the Rive focus domain. We route certain keys to different functions, with the following
         * fallback behavior:
         * 1. Tab/Shift+Tab - check if keyInput() takes this key, if not, call focusNext/Previous traversal if there are focus nodes
         * 2. Check - if a semantic overlay element's key handler claimed the event, don't intercept the key event further
         * 3. Send key to `keyInput()` on Rive state machine if applicable.
         * 4. If the keyInput returned false, and the key is directional arrow keys, call directional focus methods on state machine
         * 5. Printables: in a session the proxy's input event supplies text; otherwise textInput().
         *    A printable fires both keyInput and textInput even if a listener claims it.
         * @param event KeyboardEvent
         * @returns void
         */
        this.onKeyDown = function (event) {
            _this.syncOverlayListener();
            // Keys that are part of an IME composition belong to the IME (candidate
            // navigation, commit). Safari reports the first one as keyCode 229 with
            // isComposing still false.
            if (event.isComposing || event.keyCode === 229)
                return;
            // After Tab exits the last Rive node, ignore keys until focus re-enters the focus domain.
            if (_this.focusDomainReleased)
                return;
            if (!_this.shouldRiveHandleKeyEvent(event))
                return;
            if (event.key === "Tab" && _this.hasFocusNodes) {
                // Tab listeners are matched per phase (down/repeat/up), as in the editor, so
                // each event is offered on its own; one that isn't claimed traverses.
                if (_this.mainSm.focusState().hasFocus &&
                    _this.mainSm.keyInput(_keyMap__WEBPACK_IMPORTED_MODULE_0__.Key.tab, (0,_keyMap__WEBPACK_IMPORTED_MODULE_0__.modifiersFromEvent)(event), true, event.repeat)) {
                    event.preventDefault();
                    return;
                }
                var forward = !event.shiftKey;
                var focusMoved = forward ? _this.mainSm.focusNext() : _this.mainSm.focusPrevious();
                var focusState = _this.mainSm.focusState();
                // focusMoved is false both at a Stop edge (focus stays put) and after walking off
                // the tree (focus cleared), so hasFocus discerns Stop edge from Rive releasing focus
                if (focusMoved || focusState.hasFocus) {
                    // A Rive node holds focus — keep trapping Tab inside Rive.
                    _this.focusSessionState = FocusSessionState.RiveFocused;
                    event.preventDefault();
                }
                else {
                    // No more traversable nodes — release Tab to the page.
                    if (document.activeElement !== _this.canvas &&
                        _this.isInFocusDomain(document.activeElement)) {
                        // The browser's default Tab starts from the focused element; from an overlay element,
                        // the nearest stop backward is the canvas itself. Start it from the
                        // canvas instead, so a Shift+Tab goes to the proper element before Rive.
                        _this.canvas.focus({ preventScroll: true });
                    }
                    _this.focusSessionState = FocusSessionState.NotFocused;
                    _this.focusDomainReleased = true;
                    _this.canvasHasFocus = false;
                }
                _this.syncOverlayListener();
                return;
            }
            // A semantic overlay widget (roving radio/tab group, slider, Enter/Space activation)
            // already acted on this key at its target, so don't act on it twice.
            if ((0,_semantics_claimedKeyEvents__WEBPACK_IMPORTED_MODULE_1__.isKeyEventClaimed)(event)) {
                _this.claimedKeyCodes.add(event.code);
                return;
            }
            // A new unclaimed press: drop any claim whose keyup never arrived.
            _this.claimedKeyCodes.delete(event.code);
            var fromProxy = _this.textInputSessionActive && _this.inputProxy.owns(event.target);
            var expectsKeyboardInput = _this.mainSm.focusState().expectsKeyboardInput;
            // The focused node gets first refusal (a TextInput's caret, or a keyboard listener
            // on that key). Keys with no Rive equivalent map to null and aren't dispatched.
            var key = (0,_keyMap__WEBPACK_IMPORTED_MODULE_0__.keyboardEventToRiveKey)(event);
            var consumed = key !== null &&
                _this.mainSm.keyInput(key, (0,_keyMap__WEBPACK_IMPORTED_MODULE_0__.modifiersFromEvent)(event), true, event.repeat);
            // An arrow key with no consumed key input moves focus spatially. While a Rive node holds focus,
            // arrows never scroll the page
            if (!consumed && key !== null && isArrowKey(key) && !hasShortcutModifier(event)) {
                consumed =
                    _this.focusInDirection(key) || _this.mainSm.focusState().hasFocus;
            }
            if (isPrintable(event)) {
                // During a session the printable must reach the proxy: its input event is the
                // (IME- and dead-key-correct) text source, and C++ inserts nothing from keyInput.
                if (fromProxy)
                    return;
                // Session live but focus elsewhere in Rive: refocus the proxy so the default inserts there.
                if (_this.textInputSessionActive && _this.isInFocusDomain(event.target)) {
                    _this.inputProxy.focus();
                    return;
                }
                if (!_this.textInputSessionActive && expectsKeyboardInput) {
                    _this.mainSm.textInput(event.key);
                }
            }
            // Rive consumed it, or an unmodified editing key while typing (would scroll/submit).
            var typing = fromProxy || expectsKeyboardInput;
            if (consumed ||
                (typing && !hasShortcutModifier(event) && EDITING_NAV_CODES.has(event.code))) {
                event.preventDefault();
            }
        };
        this.onKeyUp = function (event) {
            if (event.isComposing || event.keyCode === 229)
                return;
            if (_this.claimedKeyCodes.delete(event.code))
                return;
            if (_this.focusSessionState === FocusSessionState.NotFocused)
                return;
            var key = (0,_keyMap__WEBPACK_IMPORTED_MODULE_0__.keyboardEventToRiveKey)(event);
            if (key === null)
                return;
            _this.mainSm.keyInput(key, (0,_keyMap__WEBPACK_IMPORTED_MODULE_0__.modifiersFromEvent)(event), false, false);
        };
        this.canvas = canvas;
        this.mainSm = stateMachine;
        this.hasFocusNodes = hasFocusNodes;
        this.getOverlayElement = getOverlayElement;
        this.focusDomainHost = (_b = canvas.parentElement) !== null && _b !== void 0 ? _b : document;
        canvas.addEventListener("focus", this.onCanvasFocus);
        canvas.addEventListener("blur", this.onCanvasBlur);
        canvas.addEventListener("keydown", this.onKeyDown);
        canvas.addEventListener("keyup", this.onKeyUp);
        this.focusDomainHost.addEventListener("focusin", this.onFocusDomainHostFocusIn);
        this.syncOverlayListener();
        this.inputProxy = new _textInputProxy__WEBPACK_IMPORTED_MODULE_2__.TextInputProxy({
            container: (_c = canvas.parentElement) !== null && _c !== void 0 ? _c : document.body,
            canvas: canvas,
            textInput: function (text) { return _this.mainSm.textInput(text); },
            // Proxy keystrokes go through the same handlers as the canvas.
            onKeyDown: this.onKeyDown,
            onKeyUp: this.onKeyUp,
            onCopy: this.onCopy,
            onBlur: function (relatedTarget) { return _this.handleProxyBlur(relatedTarget); },
        });
    }
    KeyboardInteractions.prototype.isTextInputSessionActive = function () {
        return this.textInputSessionActive;
    };
    /** Session active and the proxy holds DOM focus. */
    KeyboardInteractions.prototype.isEditingHostFocused = function () {
        return this.textInputSessionActive && this.inputProxy.hasDomFocus();
    };
    /** @param focusProxy move DOM focus to the proxy; false leaves it where it is. */
    KeyboardInteractions.prototype.beginTextInputSession = function (focusProxy) {
        this.textInputSessionActive = true;
        this.focusSessionState = FocusSessionState.RiveFocused;
        if (focusProxy)
            this.inputProxy.focus();
    };
    /** @param fromBlur focus is already leaving; don't park it on the canvas. */
    KeyboardInteractions.prototype.endTextInputSession = function (fromBlur) {
        if (fromBlur === void 0) { fromBlur = false; }
        if (!this.textInputSessionActive)
            return;
        this.textInputSessionActive = false;
        this.inputProxy.endSession();
        if (fromBlur || !this.inputProxy.hasDomFocus())
            return;
        // Nothing took DOM focus from the proxy (e.g. semantics is off). Park it on the
        // canvas so keys keep reaching Rive; onCanvasFocus ignores focus from the input proxy.
        this.canvas.focus({ preventScroll: true });
    };
    /** Must run synchronously in the pointer gesture or mobile keyboards won't open. */
    KeyboardInteractions.prototype.summonForPointer = function () {
        if (this.textInputSessionActive)
            this.inputProxy.focus();
        else
            this.beginTextInputSession(true);
    };
    Object.defineProperty(KeyboardInteractions.prototype, "editingHost", {
        /** The text-input proxy, for the semantics layer to decorate while editing. */
        get: function () {
            return this.inputProxy;
        },
        enumerable: false,
        configurable: true
    });
    KeyboardInteractions.prototype.handleProxyBlur = function (relatedTarget) {
        // Teardown already in progress (endTextInputSession blurred the proxy).
        if (!this.textInputSessionActive)
            return;
        // Still in Rive or the document blurred: keep the session (pollFocusState tears down).
        if (this.blurStaysWithRive(relatedTarget))
            return;
        // Blurred out of Rive entirely: release C++ focus and end the session.
        this.mainSm.clearFocus();
        this.endTextInputSession(true);
        this.focusSessionState = FocusSessionState.NotFocused;
    };
    /**
     * Set the FocusSessionState. Useful for invoking a Rive "blur" without actually blurring from the <canvas>. This
     * helps put the DOM focus state on the canvas rather than the <body>, so the user doesn't lose the spot in page navigation
     *
     * @param state FocusSessionState enum
     */
    KeyboardInteractions.prototype.setFocusSessionState = function (state) {
        this.focusSessionState = state;
    };
    /**
     * Called by pollFocusState on the Rive instance when it observes hasFocus=true. Rive acquired
     * focus internally (e.g. via a listener action or state transition) without a DOM focus event,
     * so mark the session RiveFocused. This cannot resurrect a session that a DOM blur ended,
     * because onCanvasBlur clears Rive's focus alongside it.
     */
    KeyboardInteractions.prototype.notifyRiveFocused = function () {
        this.focusSessionState = FocusSessionState.RiveFocused;
    };
    /** Blur into the focus domain, or the whole document losing focus (tab/window switch). */
    KeyboardInteractions.prototype.blurStaysWithRive = function (relatedTarget) {
        return (this.isInFocusDomain(relatedTarget) ||
            (relatedTarget === null && !document.hasFocus()));
    };
    /** Arrow keys map to directional focus; anything else is not a focus move. */
    KeyboardInteractions.prototype.focusInDirection = function (key) {
        switch (key) {
            case _keyMap__WEBPACK_IMPORTED_MODULE_0__.Key.left:
                return this.mainSm.focusLeft();
            case _keyMap__WEBPACK_IMPORTED_MODULE_0__.Key.right:
                return this.mainSm.focusRight();
            case _keyMap__WEBPACK_IMPORTED_MODULE_0__.Key.up:
                return this.mainSm.focusUp();
            case _keyMap__WEBPACK_IMPORTED_MODULE_0__.Key.down:
                return this.mainSm.focusDown();
            default:
                return false;
        }
    };
    /**
     * Determine if Rive should handle keyboard input. If session state is `NotFocused` - no.
     * DOM focus stays parked on the canvas after Rive releases focus internally, and that Tab
     * has to reach the page rather than re-enter the tree.
     *
     * Otherwise, the event still has to belong to Rive:
     * 1. If the current DOM focus is in Rive domain (canvas or semantic overlay)
     * 2. If the target for the key input is for the semantic overlay, or the canvas
     */
    KeyboardInteractions.prototype.shouldRiveHandleKeyEvent = function (event) {
        if (this.focusSessionState === FocusSessionState.NotFocused)
            return false;
        var inFocusDomain = this.isInFocusDomain(document.activeElement) ||
            this.isInOverlay(event.target);
        var eventOnCanvas = event.target === this.canvas;
        return inFocusDomain || this.canvasHasFocus || eventOnCanvas;
    };
    /** DOM that counts as inside Rive for focus: canvas, overlay subtree, text-input proxy. */
    KeyboardInteractions.prototype.isInFocusDomain = function (target) {
        if (target === this.canvas)
            return true;
        if (this.inputProxy.owns(target))
            return true;
        return this.isInOverlay(target);
    };
    /** Overlay only (excludes the canvas) — the accessibility overlay subtree. */
    KeyboardInteractions.prototype.isInOverlay = function (target) {
        var _a, _b, _c;
        if (!(target instanceof Node))
            return false;
        return (_c = (_b = (_a = this.getOverlayElement) === null || _a === void 0 ? void 0 : _a.call(this)) === null || _b === void 0 ? void 0 : _b.contains(target)) !== null && _c !== void 0 ? _c : false;
    };
    KeyboardInteractions.prototype.syncOverlayListener = function () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        var nextOverlayElement = (_b = (_a = this.getOverlayElement) === null || _a === void 0 ? void 0 : _a.call(this)) !== null && _b !== void 0 ? _b : null;
        if (nextOverlayElement === this.currentOverlayElement)
            return;
        (_c = this.currentOverlayElement) === null || _c === void 0 ? void 0 : _c.removeEventListener("focusin", this.onOverlayFocusIn);
        (_d = this.currentOverlayElement) === null || _d === void 0 ? void 0 : _d.removeEventListener("keydown", this.onKeyDown);
        (_e = this.currentOverlayElement) === null || _e === void 0 ? void 0 : _e.removeEventListener("keyup", this.onKeyUp);
        this.currentOverlayElement = nextOverlayElement;
        (_f = this.currentOverlayElement) === null || _f === void 0 ? void 0 : _f.addEventListener("focusin", this.onOverlayFocusIn);
        // Bubble phase, so a semantic widget's own key handler runs first and can claim
        // the key via claimKeyEvent (see onKeyDown).
        (_g = this.currentOverlayElement) === null || _g === void 0 ? void 0 : _g.addEventListener("keydown", this.onKeyDown);
        (_h = this.currentOverlayElement) === null || _h === void 0 ? void 0 : _h.addEventListener("keyup", this.onKeyUp);
    };
    /**
     * Whether the canvas currently matches :focus-visible — the browser's heuristic for keyboard-
     * (vs pointer-) driven focus. For older browser versions that don't support this selector, return false
     * so that we don't incorrectly assume pointer vs keyboard focus. Next tab would enter the focus tree in those edge cases.
     */
    KeyboardInteractions.prototype.isKeyboardDrivenFocus = function () {
        try {
            return this.canvas.matches(":focus-visible");
        }
        catch (_a) {
            return false;
        }
    };
    KeyboardInteractions.prototype.cameFromBeforeCanvas = function (from) {
        if (!from)
            return true;
        var position = this.canvas.compareDocumentPosition(from);
        if (position & Node.DOCUMENT_POSITION_PRECEDING)
            return true;
        if (position & Node.DOCUMENT_POSITION_FOLLOWING)
            return false;
        return true;
    };
    KeyboardInteractions.prototype.cleanup = function () {
        var _a, _b, _c;
        this.canvas.removeEventListener("focus", this.onCanvasFocus);
        this.canvas.removeEventListener("blur", this.onCanvasBlur);
        this.canvas.removeEventListener("keydown", this.onKeyDown);
        this.canvas.removeEventListener("keyup", this.onKeyUp);
        this.claimedKeyCodes.clear();
        this.focusDomainHost.removeEventListener("focusin", this.onFocusDomainHostFocusIn);
        (_a = this.currentOverlayElement) === null || _a === void 0 ? void 0 : _a.removeEventListener("focusin", this.onOverlayFocusIn);
        (_b = this.currentOverlayElement) === null || _b === void 0 ? void 0 : _b.removeEventListener("keydown", this.onKeyDown);
        (_c = this.currentOverlayElement) === null || _c === void 0 ? void 0 : _c.removeEventListener("keyup", this.onKeyUp);
        // Removing a focused element drops focus to <body> with no blur; park on the canvas.
        if (this.inputProxy.hasDomFocus()) {
            this.canvas.focus({ preventScroll: true });
        }
        this.inputProxy.cleanup();
        this.textInputSessionActive = false;
    };
    return KeyboardInteractions;
}());



/***/ }),
/* 15 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Key: () => (/* binding */ Key),
/* harmony export */   KeyModifiers: () => (/* binding */ KeyModifiers),
/* harmony export */   keyboardEventToRiveKey: () => (/* binding */ keyboardEventToRiveKey),
/* harmony export */   modifiersFromEvent: () => (/* binding */ modifiersFromEvent)
/* harmony export */ });
/*
 * Maps DOM keyboard events to the GLFW-style key codes and modifier bitmask
 * that StateMachineInstance.keyInput() expects. Values mirror `enum class Key`
 * and `enum class KeyModifiers` in rive-runtime focusable.hpp;
 * they are stable GLFW codes, so they live here as constants instead of an
 * embind enum.
 */
var __spreadArray = (undefined && undefined.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var Key = {
    space: 32,
    apostrophe: 39, // '
    comma: 44, // ,
    minus: 45, // -
    period: 46, // .
    slash: 47, // /
    key0: 48,
    key1: 49,
    key2: 50,
    key3: 51,
    key4: 52,
    key5: 53,
    key6: 54,
    key7: 55,
    key8: 56,
    key9: 57,
    semicolon: 59, // ;
    equal: 61, // =
    a: 65,
    b: 66,
    c: 67,
    d: 68,
    e: 69,
    f: 70,
    g: 71,
    h: 72,
    i: 73,
    j: 74,
    k: 75,
    l: 76,
    m: 77,
    n: 78,
    o: 79,
    p: 80,
    q: 81,
    r: 82,
    s: 83,
    t: 84,
    u: 85,
    v: 86,
    w: 87,
    x: 88,
    y: 89,
    z: 90,
    leftBracket: 91, // [
    backslash: 92, // \
    rightBracket: 93, // ]
    graveAccent: 96, // `
    world1: 161, // non-US #1
    world2: 162, // non-US #2
    escape: 256,
    enter: 257,
    tab: 258,
    backspace: 259,
    insert: 260,
    deleteKey: 261,
    right: 262,
    left: 263,
    down: 264,
    up: 265,
    pageUp: 266,
    pageDown: 267,
    home: 268,
    end: 269,
    capsLock: 280,
    scrollLock: 281,
    numLock: 282,
    printScreen: 283,
    pause: 284,
    f1: 290,
    f2: 291,
    f3: 292,
    f4: 293,
    f5: 294,
    f6: 295,
    f7: 296,
    f8: 297,
    f9: 298,
    f10: 299,
    f11: 300,
    f12: 301,
    f13: 302,
    f14: 303,
    f15: 304,
    f16: 305,
    f17: 306,
    f18: 307,
    f19: 308,
    f20: 309,
    f21: 310,
    f22: 311,
    f23: 312,
    f24: 313,
    f25: 314,
    kp0: 320,
    kp1: 321,
    kp2: 322,
    kp3: 323,
    kp4: 324,
    kp5: 325,
    kp6: 326,
    kp7: 327,
    kp8: 328,
    kp9: 329,
    kpDecimal: 330,
    kpDivide: 331,
    kpMultiply: 332,
    kpSubtract: 333,
    kpAdd: 334,
    kpEnter: 335,
    kpEqual: 336,
    leftShift: 340,
    leftControl: 341,
    leftAlt: 342,
    leftSuper: 343,
    rightShift: 344,
    rightControl: 345,
    rightAlt: 346,
    rightSuper: 347,
    menu: 348,
};
var KeyModifiers = {
    none: 0,
    shift: 1 << 0,
    ctrl: 1 << 1,
    alt: 1 << 2,
    meta: 1 << 3,
};
// Physical key (KeyboardEvent.code) to Rive key, by US-QWERTY position.
var CODE_TO_KEY = {
    // Modifiers are keys too (the editor sends them), and are also in the bitmask.
    ShiftLeft: Key.leftShift,
    ShiftRight: Key.rightShift,
    ControlLeft: Key.leftControl,
    ControlRight: Key.rightControl,
    AltLeft: Key.leftAlt,
    AltRight: Key.rightAlt,
    MetaLeft: Key.leftSuper,
    MetaRight: Key.rightSuper,
    KeyA: Key.a,
    KeyB: Key.b,
    KeyC: Key.c,
    KeyD: Key.d,
    KeyE: Key.e,
    KeyF: Key.f,
    KeyG: Key.g,
    KeyH: Key.h,
    KeyI: Key.i,
    KeyJ: Key.j,
    KeyK: Key.k,
    KeyL: Key.l,
    KeyM: Key.m,
    KeyN: Key.n,
    KeyO: Key.o,
    KeyP: Key.p,
    KeyQ: Key.q,
    KeyR: Key.r,
    KeyS: Key.s,
    KeyT: Key.t,
    KeyU: Key.u,
    KeyV: Key.v,
    KeyW: Key.w,
    KeyX: Key.x,
    KeyY: Key.y,
    KeyZ: Key.z,
    Digit0: Key.key0,
    Digit1: Key.key1,
    Digit2: Key.key2,
    Digit3: Key.key3,
    Digit4: Key.key4,
    Digit5: Key.key5,
    Digit6: Key.key6,
    Digit7: Key.key7,
    Digit8: Key.key8,
    Digit9: Key.key9,
    Numpad0: Key.kp0,
    Numpad1: Key.kp1,
    Numpad2: Key.kp2,
    Numpad3: Key.kp3,
    Numpad4: Key.kp4,
    Numpad5: Key.kp5,
    Numpad6: Key.kp6,
    Numpad7: Key.kp7,
    Numpad8: Key.kp8,
    Numpad9: Key.kp9,
    NumpadDecimal: Key.kpDecimal,
    NumpadDivide: Key.kpDivide,
    NumpadMultiply: Key.kpMultiply,
    NumpadSubtract: Key.kpSubtract,
    NumpadAdd: Key.kpAdd,
    NumpadEnter: Key.kpEnter,
    NumpadEqual: Key.kpEqual,
    Minus: Key.minus,
    Equal: Key.equal,
    BracketLeft: Key.leftBracket,
    BracketRight: Key.rightBracket,
    Backslash: Key.backslash,
    Semicolon: Key.semicolon,
    Quote: Key.apostrophe,
    Backquote: Key.graveAccent,
    Comma: Key.comma,
    Period: Key.period,
    Slash: Key.slash,
    IntlBackslash: Key.world1,
    IntlRo: Key.world2,
    Space: Key.space,
    Enter: Key.enter,
    Tab: Key.tab,
    Backspace: Key.backspace,
    Insert: Key.insert,
    Delete: Key.deleteKey,
    Escape: Key.escape,
    ArrowRight: Key.right,
    ArrowLeft: Key.left,
    ArrowDown: Key.down,
    ArrowUp: Key.up,
    PageUp: Key.pageUp,
    PageDown: Key.pageDown,
    Home: Key.home,
    End: Key.end,
    CapsLock: Key.capsLock,
    ScrollLock: Key.scrollLock,
    NumLock: Key.numLock,
    PrintScreen: Key.printScreen,
    Pause: Key.pause,
    ContextMenu: Key.menu,
    F1: Key.f1,
    F2: Key.f2,
    F3: Key.f3,
    F4: Key.f4,
    F5: Key.f5,
    F6: Key.f6,
    F7: Key.f7,
    F8: Key.f8,
    F9: Key.f9,
    F10: Key.f10,
    F11: Key.f11,
    F12: Key.f12,
    F13: Key.f13,
    F14: Key.f14,
    F15: Key.f15,
    F16: Key.f16,
    F17: Key.f17,
    F18: Key.f18,
    F19: Key.f19,
    F20: Key.f20,
    F21: Key.f21,
    F22: Key.f22,
    F23: Key.f23,
    F24: Key.f24,
    F25: Key.f25,
};
// Unshifted characters (event.key, lowercased) that name a Rive key.
var CHAR_TO_KEY = (function () {
    var map = {
        " ": Key.space,
        "'": Key.apostrophe,
        ",": Key.comma,
        "-": Key.minus,
        ".": Key.period,
        "/": Key.slash,
        ";": Key.semicolon,
        "=": Key.equal,
        "[": Key.leftBracket,
        "\\": Key.backslash,
        "]": Key.rightBracket,
        "`": Key.graveAccent,
    };
    for (var c = 0; c < 26; c++)
        map[String.fromCharCode(97 + c)] = Key.a + c;
    for (var d = 0; d <= 9; d++)
        map[String(d)] = Key.key0 + d;
    return map;
})();
// Non-printable event.key values; each shares its name with its code.
var NAMED_KEYS = new Set(__spreadArray([
    "Enter",
    "Tab",
    "Backspace",
    "Insert",
    "Delete",
    "Escape",
    "ArrowRight",
    "ArrowLeft",
    "ArrowDown",
    "ArrowUp",
    "PageUp",
    "PageDown",
    "Home",
    "End",
    "CapsLock",
    "ScrollLock",
    "NumLock",
    "PrintScreen",
    "Pause",
    "ContextMenu"
], Array.from({ length: 25 }, function (_, i) { return "F".concat(i + 1); }), true));
/**
 * Maps a KeyboardEvent to a Rive key, or null if Rive has no equivalent.
 *
 * Resolves the logical key: what the user's layout labels the key, ignoring
 * Shift, so a listener on "A" fires on AZERTY's A too. `event.key` is preferred;
 * `event.code` is the fallback when `key` isn't a plain unshifted character
 * (shifted symbols, Option/AltGr output, non-Latin letters, dead keys).
 * Digit-row and numpad keys skip the character lookup so AZERTY's digit row
 * still reports digits and numpad digits stay distinct from the digit row.
 */
function keyboardEventToRiveKey(event) {
    var _a, _b;
    var code = event.code, key = event.key;
    if (NAMED_KEYS.has(key)) {
        // NumpadEnter reports key "Enter"; keep it distinct.
        return code === "NumpadEnter" ? Key.kpEnter : (_a = CODE_TO_KEY[key]) !== null && _a !== void 0 ? _a : null;
    }
    if (!code.startsWith("Digit") && !code.startsWith("Numpad") && key) {
        var fromChar = CHAR_TO_KEY[key.toLowerCase()];
        if (fromChar !== undefined)
            return fromChar;
    }
    return (_b = CODE_TO_KEY[code]) !== null && _b !== void 0 ? _b : null;
}
function modifiersFromEvent(event) {
    var modifiers = KeyModifiers.none;
    if (event.shiftKey)
        modifiers |= KeyModifiers.shift;
    if (event.ctrlKey)
        modifiers |= KeyModifiers.ctrl;
    if (event.altKey)
        modifiers |= KeyModifiers.alt;
    if (event.metaKey)
        modifiers |= KeyModifiers.meta;
    return modifiers;
}


/***/ }),
/* 16 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TextInputProxy: () => (/* binding */ TextInputProxy)
/* harmony export */ });
/* harmony import */ var _canvasOffset__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(11);

// 16px: the smallest font size at which iOS Safari doesn't zoom on focus
var FONT_SIZE_PX = 16;
/** Capture-critical attributes decorate() must not touch. */
var PROTECTED_ATTRS = new Set([
    "type",
    "value",
    "style",
    "tabindex",
    "autocapitalize",
    "autocomplete",
    "autocorrect",
    "spellcheck",
]);
/**
 * Invisible per-instance <input> capturing IME/dead-key/paste text; focusable inside a
 * gesture to raise mobile keyboards. Always empty: C++ owns value and caret. Decorated
 * for AT only while it holds DOM focus.
 */
var TextInputProxy = /** @class */ (function () {
    function TextInputProxy(params) {
        var _this = this;
        // True between compositionstart/compositionend; we never commit mid-composition.
        this.composing = false;
        // Names set by decorate(), removed by resetDecoration().
        this.decoratedKeys = new Set();
        // Last written left/top, to skip no-op style writes.
        this.lastLeft = NaN;
        this.lastTop = NaN;
        /** Re-sync before input: the canvas may have scrolled since the session began. */
        this.reposition = function () { return _this.positionOverCanvas(); };
        this.onCompositionStart = function () {
            _this.composing = true;
        };
        this.onCompositionEnd = function () {
            _this.composing = false;
            // The composed text is now committed in element.value; forward it here. A
            // trailing `input` event (order varies by browser) then sees an empty field.
            _this.commit();
        };
        this.onInput = function () {
            if (_this.composing)
                return;
            _this.commit();
        };
        // An <input type=text> strips line breaks from its value, so forward the clipboard
        // text directly. Core's single-line fields strip them themselves.
        this.onPaste = function (event) {
            var _a;
            var text = (_a = event.clipboardData) === null || _a === void 0 ? void 0 : _a.getData("text/plain");
            if (!text)
                return;
            event.preventDefault();
            _this.params.textInput(text.replace(/\r\n?/g, "\n"));
        };
        this.onBlur = function (event) {
            _this.params.onBlur(event.relatedTarget);
        };
        this.params = params;
        this.element = this.createElement();
        this.positionOverCanvas();
        // Order vs. the overlay is unspecified; fine, Tab release starts from the canvas.
        this.params.container.appendChild(this.element);
    }
    // Registered first so it runs before the key handler inserts or moves the caret.
    TextInputProxy.prototype.listeners = function () {
        return [
            ["keydown", this.reposition],
            ["beforeinput", this.reposition],
            ["keydown", this.params.onKeyDown],
            ["keyup", this.params.onKeyUp],
            ["input", this.onInput],
            ["compositionstart", this.onCompositionStart],
            ["compositionend", this.onCompositionEnd],
            ["paste", this.onPaste],
            ["copy", this.params.onCopy],
            ["blur", this.onBlur],
        ];
    };
    TextInputProxy.prototype.createElement = function () {
        var el = document.createElement("input");
        el.type = "text";
        // Focusable but never in native tab order (Rive drives traversal synthetically),
        // and invisible without display:none (which would forbid focus).
        el.tabIndex = -1;
        el.setAttribute("aria-hidden", "true");
        // Always empty, so autocapitalize/autocorrect would misfire.
        el.setAttribute("autocapitalize", "off");
        el.setAttribute("autocomplete", "off");
        el.setAttribute("autocorrect", "off");
        el.spellcheck = false;
        // Over the canvas (not display:none) so iOS doesn't scroll-jump on keyboard open.
        // font-size must stay 16px or iOS Safari zooms on focus.
        el.style.cssText =
            "position:absolute;width:1px;height:1px;padding:0;margin:0;border:0;" +
                "outline:none;opacity:0;background:transparent;color:transparent;" +
                "caret-color:transparent;overflow:hidden;resize:none;z-index:0;" +
                // Focused programmatically only; must not swallow clicks
                "pointer-events:none;" +
                "font-size:".concat(FONT_SIZE_PX, "px;line-height:1;");
        for (var _i = 0, _a = this.listeners(); _i < _a.length; _i++) {
            var _b = _a[_i], type = _b[0], listener = _b[1];
            el.addEventListener(type, listener);
        }
        return el;
    };
    TextInputProxy.prototype.positionOverCanvas = function () {
        // Track the canvas (browsers scroll to the caret); clamp on-screen, one caret line box
        // (FONT_SIZE_PX) from the far edges, or the root scrolls to reveal it.
        var _a = (0,_canvasOffset__WEBPACK_IMPORTED_MODULE_0__.canvasOffset)(this.params.canvas), top = _a.top, left = _a.left;
        if (window.innerHeight > 0) {
            var r = this.params.canvas.getBoundingClientRect();
            top += clamp(r.top, 0, window.innerHeight - FONT_SIZE_PX) - r.top;
            left += clamp(r.left, 0, window.innerWidth - FONT_SIZE_PX) - r.left;
        }
        if (left !== this.lastLeft) {
            this.element.style.left = "".concat(left, "px");
            this.lastLeft = left;
        }
        if (top !== this.lastTop) {
            this.element.style.top = "".concat(top, "px");
            this.lastTop = top;
        }
    };
    /**
     * Forward the field's text to Rive and clear it.
     *
     * TODO: iOS won't autorepeat Backspace in an empty field (needs a text mirror).
     * */
    TextInputProxy.prototype.commit = function () {
        var text = this.element.value;
        if (!text)
            return;
        this.element.value = "";
        this.params.textInput(text);
    };
    /** Clear any transient value and decoration. Does not blur the element. */
    TextInputProxy.prototype.endSession = function () {
        this.element.value = "";
        // Browsers fire compositionend on blur, but a stuck flag would drop every
        // keystroke of the next session.
        this.composing = false;
        // Also covers blur-out, which bypasses the overlay.
        this.resetDecoration();
    };
    /** Must be called synchronously inside a gesture on iOS to raise the keyboard. */
    TextInputProxy.prototype.focus = function () {
        // Reposition first: iOS scrolls the focused input into view when the keyboard opens.
        this.positionOverCanvas();
        this.element.focus({ preventScroll: true });
    };
    TextInputProxy.prototype.hasDomFocus = function () {
        return document.activeElement === this.element;
    };
    TextInputProxy.prototype.owns = function (target) {
        return target === this.element;
    };
    /** See EditingHost.decorate. */
    TextInputProxy.prototype.decorate = function (attrs) {
        // aria-hidden outranks every attribute set below, so it must come off before this
        // element can stand in as the accessible element for the focused node.
        this.element.removeAttribute("aria-hidden");
        for (var _i = 0, _a = Object.entries(attrs); _i < _a.length; _i++) {
            var _b = _a[_i], name_1 = _b[0], value = _b[1];
            // Never override capture attrs.
            if (PROTECTED_ATTRS.has(name_1.toLowerCase()))
                continue;
            if (value === null) {
                this.element.removeAttribute(name_1);
                this.decoratedKeys.delete(name_1);
            }
            else {
                // Skip no-op writes: setting an attribute to the value it already has still
                // emits a mutation, and assistive tech is focused on this element mid-edit.
                if (this.element.getAttribute(name_1) !== value) {
                    this.element.setAttribute(name_1, value);
                }
                this.decoratedKeys.add(name_1);
            }
        }
    };
    /**
     * type=password for obscured fields so AT doesn't echo keys.
     * TODO: source "type" from Core, not semantics.
     */
    TextInputProxy.prototype.setSecure = function (secure) {
        var type = secure ? "password" : "text";
        if (this.element.type !== type)
            this.element.type = type;
    };
    /** Drop all decoration and return to the AT-invisible baseline. */
    TextInputProxy.prototype.resetDecoration = function () {
        var _this = this;
        this.setSecure(false);
        this.decoratedKeys.forEach(function (name) { return _this.element.removeAttribute(name); });
        this.decoratedKeys.clear();
        this.element.setAttribute("aria-hidden", "true");
    };
    TextInputProxy.prototype.cleanup = function () {
        for (var _i = 0, _a = this.listeners(); _i < _a.length; _i++) {
            var _b = _a[_i], type = _b[0], listener = _b[1];
            this.element.removeEventListener(type, listener);
        }
        this.element.remove();
    };
    return TextInputProxy;
}());

function clamp(v, min, max) {
    return Math.min(Math.max(v, min), Math.max(min, max));
}


/***/ }),
/* 17 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BLANK_URL: () => (/* binding */ BLANK_URL),
/* harmony export */   sanitizeUrl: () => (/* binding */ sanitizeUrl)
/* harmony export */ });
// Reference: https://github.com/braintree/sanitize-url/tree/main
var invalidProtocolRegex = /^([^\w]*)(javascript|data|vbscript)/im;
var htmlEntitiesRegex = /&#(\w+)(^\w|;)?/g;
var htmlCtrlEntityRegex = /&(newline|tab);/gi;
var ctrlCharactersRegex = /[\u0000-\u001F\u007F-\u009F\u2000-\u200D\uFEFF]/gim;
var urlSchemeRegex = /^.+(:|&colon;)/gim;
var relativeFirstCharacters = [".", "/"];
var BLANK_URL = "about:blank";
function isRelativeUrlWithoutProtocol(url) {
    return relativeFirstCharacters.indexOf(url[0]) > -1;
}
// adapted from https://stackoverflow.com/a/29824550/2601552
function decodeHtmlCharacters(str) {
    var removedNullByte = str.replace(ctrlCharactersRegex, "");
    return removedNullByte.replace(htmlEntitiesRegex, function (match, dec) {
        return String.fromCharCode(dec);
    });
}
function sanitizeUrl(url) {
    if (!url) {
        return BLANK_URL;
    }
    var sanitizedUrl = decodeHtmlCharacters(url)
        .replace(htmlCtrlEntityRegex, "")
        .replace(ctrlCharactersRegex, "")
        .trim();
    if (!sanitizedUrl) {
        return BLANK_URL;
    }
    if (isRelativeUrlWithoutProtocol(sanitizedUrl)) {
        return sanitizedUrl;
    }
    var urlSchemeParseResults = sanitizedUrl.match(urlSchemeRegex);
    if (!urlSchemeParseResults) {
        return sanitizedUrl;
    }
    var urlScheme = urlSchemeParseResults[0];
    if (invalidProtocolRegex.test(urlScheme)) {
        return BLANK_URL;
    }
    return sanitizedUrl;
}


/***/ }),
/* 18 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AudioAssetWrapper: () => (/* binding */ AudioAssetWrapper),
/* harmony export */   AudioWrapper: () => (/* binding */ AudioWrapper),
/* harmony export */   CustomFileAssetLoaderWrapper: () => (/* binding */ CustomFileAssetLoaderWrapper),
/* harmony export */   FileAssetWrapper: () => (/* binding */ FileAssetWrapper),
/* harmony export */   FileFinalizer: () => (/* binding */ FileFinalizer),
/* harmony export */   FontAssetWrapper: () => (/* binding */ FontAssetWrapper),
/* harmony export */   FontWrapper: () => (/* binding */ FontWrapper),
/* harmony export */   ImageAssetWrapper: () => (/* binding */ ImageAssetWrapper),
/* harmony export */   ImageWrapper: () => (/* binding */ ImageWrapper),
/* harmony export */   createFinalization: () => (/* binding */ createFinalization),
/* harmony export */   finalizationRegistry: () => (/* binding */ finalizationRegistry)
/* harmony export */ });
var __extends = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var FileFinalizer = /** @class */ (function () {
    function FileFinalizer(file, session) {
        if (session === void 0) { session = null; }
        this.selfUnref = false;
        this._file = file;
        this._session = session;
    }
    FileFinalizer.prototype.unref = function () {
        if (this._file) {
            this._file.unref();
        }
        // After the file, never before: the file's resources belong to the session.
        if (this._session) {
            this._session.delete();
            this._session = null;
        }
    };
    // Disarms the GC path for a file cleanup() already released.
    FileFinalizer.prototype.release = function () {
        this._file = null;
        this._session = null;
    };
    return FileFinalizer;
}());
var ObjectFinalizer = /** @class */ (function () {
    function ObjectFinalizer(finalizableObject) {
        this._finalizableObject = finalizableObject;
    }
    ObjectFinalizer.prototype.unref = function () {
        this._finalizableObject.unref();
    };
    return ObjectFinalizer;
}());
var AssetWrapper = /** @class */ (function () {
    function AssetWrapper() {
        this.selfUnref = false;
    }
    AssetWrapper.prototype.unref = function () { };
    return AssetWrapper;
}());
var ImageWrapper = /** @class */ (function (_super) {
    __extends(ImageWrapper, _super);
    function ImageWrapper(image) {
        var _this = _super.call(this) || this;
        _this._nativeImage = image;
        return _this;
    }
    Object.defineProperty(ImageWrapper.prototype, "nativeImage", {
        get: function () {
            return this._nativeImage;
        },
        enumerable: false,
        configurable: true
    });
    ImageWrapper.prototype.unref = function () {
        if (this.selfUnref) {
            this._nativeImage.unref();
        }
    };
    return ImageWrapper;
}(AssetWrapper));
var AudioWrapper = /** @class */ (function (_super) {
    __extends(AudioWrapper, _super);
    function AudioWrapper(audio) {
        var _this = _super.call(this) || this;
        _this._nativeAudio = audio;
        return _this;
    }
    Object.defineProperty(AudioWrapper.prototype, "nativeAudio", {
        get: function () {
            return this._nativeAudio;
        },
        enumerable: false,
        configurable: true
    });
    AudioWrapper.prototype.unref = function () {
        if (this.selfUnref) {
            this._nativeAudio.unref();
        }
    };
    return AudioWrapper;
}(AssetWrapper));
var FontWrapper = /** @class */ (function (_super) {
    __extends(FontWrapper, _super);
    function FontWrapper(font) {
        var _this = _super.call(this) || this;
        _this._nativeFont = font;
        return _this;
    }
    Object.defineProperty(FontWrapper.prototype, "nativeFont", {
        get: function () {
            return this._nativeFont;
        },
        enumerable: false,
        configurable: true
    });
    FontWrapper.prototype.unref = function () {
        if (this.selfUnref) {
            this._nativeFont.unref();
        }
    };
    return FontWrapper;
}(AssetWrapper));
var CustomFileAssetLoaderWrapper = /** @class */ (function () {
    function CustomFileAssetLoaderWrapper(runtime, loaderCallback, session) {
        if (session === void 0) { session = null; }
        this._assetLoaderCallback = loaderCallback;
        this._session = session;
        this.assetLoader = new runtime.CustomFileAssetLoader({
            loadContents: this.loadContents.bind(this),
        });
    }
    CustomFileAssetLoaderWrapper.prototype.loadContents = function (asset, bytes) {
        var assetWrapper;
        if (asset.isImage) {
            assetWrapper = new ImageAssetWrapper(asset, this._session);
        }
        else if (asset.isAudio) {
            assetWrapper = new AudioAssetWrapper(asset, this._session);
        }
        else if (asset.isFont) {
            assetWrapper = new FontAssetWrapper(asset, this._session);
        }
        else {
            return false;
        }
        return this._assetLoaderCallback(assetWrapper, bytes);
    };
    return CustomFileAssetLoaderWrapper;
}());
/**
 * Rive class representing a FileAsset with relevant metadata fields to describe
 * an asset associated wtih the Rive File
 */
var FileAssetWrapper = /** @class */ (function () {
    function FileAssetWrapper(nativeAsset, session) {
        if (session === void 0) { session = null; }
        this._nativeFileAsset = nativeAsset;
        this._session = session;
    }
    FileAssetWrapper.prototype.decode = function (bytes) {
        // The session travels with the asset so a deferred file's assets are
        // session-typed without the caller needing to know the file's rendering mode.
        this._nativeFileAsset.decode(bytes, this._session);
    };
    Object.defineProperty(FileAssetWrapper.prototype, "name", {
        get: function () {
            return this._nativeFileAsset.name;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FileAssetWrapper.prototype, "fileExtension", {
        get: function () {
            return this._nativeFileAsset.fileExtension;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FileAssetWrapper.prototype, "uniqueFilename", {
        get: function () {
            return this._nativeFileAsset.uniqueFilename;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FileAssetWrapper.prototype, "isAudio", {
        get: function () {
            return this._nativeFileAsset.isAudio;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FileAssetWrapper.prototype, "isImage", {
        get: function () {
            return this._nativeFileAsset.isImage;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FileAssetWrapper.prototype, "isFont", {
        get: function () {
            return this._nativeFileAsset.isFont;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FileAssetWrapper.prototype, "cdnUuid", {
        get: function () {
            return this._nativeFileAsset.cdnUuid;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FileAssetWrapper.prototype, "nativeFileAsset", {
        get: function () {
            return this._nativeFileAsset;
        },
        enumerable: false,
        configurable: true
    });
    return FileAssetWrapper;
}());
/**
 * Rive class extending the FileAsset that exposes a `setRenderImage()` API with a
 * decoded Image (via the `decodeImage()` API) to set a new Image on the Rive FileAsset
 */
var ImageAssetWrapper = /** @class */ (function (_super) {
    __extends(ImageAssetWrapper, _super);
    function ImageAssetWrapper() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ImageAssetWrapper.prototype.setRenderImage = function (image) {
        this._nativeFileAsset.setRenderImage(image.nativeImage);
    };
    return ImageAssetWrapper;
}(FileAssetWrapper));
/**
 * Rive class extending the FileAsset that exposes a `setAudioSource()` API with a
 * decoded Audio (via the `decodeAudio()` API) to set a new Audio on the Rive FileAsset
 */
var AudioAssetWrapper = /** @class */ (function (_super) {
    __extends(AudioAssetWrapper, _super);
    function AudioAssetWrapper() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AudioAssetWrapper.prototype.setAudioSource = function (audio) {
        this._nativeFileAsset.setAudioSource(audio.nativeAudio);
    };
    return AudioAssetWrapper;
}(FileAssetWrapper));
/**
 * Rive class extending the FileAsset that exposes a `setFont()` API with a
 * decoded Font (via the `decodeFont()` API) to set a new Font on the Rive FileAsset
 */
var FontAssetWrapper = /** @class */ (function (_super) {
    __extends(FontAssetWrapper, _super);
    function FontAssetWrapper() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    FontAssetWrapper.prototype.setFont = function (font) {
        this._nativeFileAsset.setFont(font.nativeFont);
    };
    return FontAssetWrapper;
}(FileAssetWrapper));
var FakeFinalizationRegistry = /** @class */ (function () {
    function FakeFinalizationRegistry(_) {
    }
    FakeFinalizationRegistry.prototype.register = function (object) {
        object.selfUnref = true;
    };
    FakeFinalizationRegistry.prototype.unregister = function (_) { };
    return FakeFinalizationRegistry;
}());
var MyFinalizationRegistry = typeof FinalizationRegistry !== "undefined"
    ? FinalizationRegistry
    : FakeFinalizationRegistry;
var finalizationRegistry = new MyFinalizationRegistry(function (ob) {
    ob === null || ob === void 0 ? void 0 : ob.unref();
});
var createFinalization = function (target, finalizable) {
    var finalizer = new ObjectFinalizer(finalizable);
    finalizationRegistry.register(target, finalizer);
};



/***/ }),
/* 19 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   RiveFont: () => (/* binding */ RiveFont)
/* harmony export */ });
/* harmony import */ var _runtimeLoader__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);

// Class to manage fallback fonts for Rive.
var RiveFont = /** @class */ (function () {
    // Class is never instantiated
    function RiveFont() {
    }
    /**
     * Set a callback to dynamically set a list of fallback fonts based on the missing glyph and/or style of the default font.
     * Set null to clear the callback.
     * @param fontCallback Callback to set a list of fallback fonts.
     */
    RiveFont.setFallbackFontCallback = function (fontCallback) {
        RiveFont._fallbackFontCallback = fontCallback !== null && fontCallback !== void 0 ? fontCallback : null;
        RiveFont._wireFallbackProc();
    };
    // Get the pointer value to the Embind Font object from FontWrapper
    RiveFont._fontToPtr = function (fontWrapper) {
        var _a;
        if (fontWrapper == null)
            return null;
        var embindFont = fontWrapper.nativeFont;
        var ptr = (_a = embindFont === null || embindFont === void 0 ? void 0 : embindFont.ptr) === null || _a === void 0 ? void 0 : _a.call(embindFont);
        return ptr !== null && ptr !== void 0 ? ptr : null;
    };
    RiveFont._getFallbackPtr = function (fonts, index) {
        if (index < 0 || index >= fonts.length)
            return null;
        return RiveFont._fontToPtr(fonts[index]);
    };
    // Create the callback Rive expects to use for fallback fonts (regardless if set via a user-supplied static list, or callback)
    // 1. Ensure WASM is ready
    // 2. Bias for checking user callback over static list of fonts and pass it down to Rive to store as reference
    //    - When calling the user callback, check if we have any fonts left to check, and if not, return null to indicate there are no more fallbacks to try.
    //    - If the user callback returns an array of fonts, pass the pointer value to Rive of the font to try
    // 3. If no callback is provided, or the callback returns null, try the static list of fonts if they set any
    // 4. If no fallback method is set, return null.
    RiveFont._wireFallbackProc = function () {
        _runtimeLoader__WEBPACK_IMPORTED_MODULE_0__.RuntimeLoader.getInstance(function (rive) {
            var cb = RiveFont._fallbackFontCallback;
            if (cb) {
                rive.setFallbackFontCallback((function (missingGlyph, fallbackFontIndex, weight) {
                    var fontsReturned = cb(missingGlyph, weight);
                    if (fontsReturned) {
                        if (Array.isArray(fontsReturned)) {
                            return RiveFont._getFallbackPtr(fontsReturned, fallbackFontIndex);
                        }
                        // If the user callback only returns a single font, provide it to Rive the first time, otherwise if Rive
                        // calls back a second time, return null to indicate there are no more fallbacks to try.
                        return fallbackFontIndex === 0 ? RiveFont._fontToPtr(fontsReturned) : null;
                    }
                    return null;
                }));
            }
            else {
                rive.setFallbackFontCallback(null);
            }
        });
    };
    RiveFont._fallbackFontCallback = null;
    return RiveFont;
}());



/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Alignment: () => (/* binding */ Alignment),
/* harmony export */   DataEnum: () => (/* binding */ DataEnum),
/* harmony export */   DataType: () => (/* binding */ DataType),
/* harmony export */   DeprecationKeys: () => (/* binding */ DeprecationKeys),
/* harmony export */   DrawOptimizationOptions: () => (/* binding */ DrawOptimizationOptions),
/* harmony export */   EventType: () => (/* binding */ EventType),
/* harmony export */   Fit: () => (/* binding */ Fit),
/* harmony export */   Layout: () => (/* binding */ Layout),
/* harmony export */   LoopType: () => (/* binding */ LoopType),
/* harmony export */   Rive: () => (/* binding */ Rive),
/* harmony export */   RiveEventType: () => (/* binding */ RiveEventType),
/* harmony export */   RiveFile: () => (/* binding */ RiveFile),
/* harmony export */   RiveFont: () => (/* reexport safe */ _utils__WEBPACK_IMPORTED_MODULE_3__.RiveFont),
/* harmony export */   RuntimeLoader: () => (/* reexport safe */ _runtimeLoader__WEBPACK_IMPORTED_MODULE_1__.RuntimeLoader),
/* harmony export */   SemanticMode: () => (/* reexport safe */ _semantics__WEBPACK_IMPORTED_MODULE_2__.SemanticMode),
/* harmony export */   StateMachineInput: () => (/* binding */ StateMachineInput),
/* harmony export */   StateMachineInputType: () => (/* binding */ StateMachineInputType),
/* harmony export */   Testing: () => (/* binding */ Testing),
/* harmony export */   ViewModel: () => (/* binding */ ViewModel),
/* harmony export */   ViewModelInstance: () => (/* binding */ ViewModelInstance),
/* harmony export */   ViewModelInstanceArtboard: () => (/* binding */ ViewModelInstanceArtboard),
/* harmony export */   ViewModelInstanceAssetFont: () => (/* binding */ ViewModelInstanceAssetFont),
/* harmony export */   ViewModelInstanceAssetImage: () => (/* binding */ ViewModelInstanceAssetImage),
/* harmony export */   ViewModelInstanceBoolean: () => (/* binding */ ViewModelInstanceBoolean),
/* harmony export */   ViewModelInstanceColor: () => (/* binding */ ViewModelInstanceColor),
/* harmony export */   ViewModelInstanceEnum: () => (/* binding */ ViewModelInstanceEnum),
/* harmony export */   ViewModelInstanceList: () => (/* binding */ ViewModelInstanceList),
/* harmony export */   ViewModelInstanceNumber: () => (/* binding */ ViewModelInstanceNumber),
/* harmony export */   ViewModelInstanceString: () => (/* binding */ ViewModelInstanceString),
/* harmony export */   ViewModelInstanceTrigger: () => (/* binding */ ViewModelInstanceTrigger),
/* harmony export */   ViewModelInstanceValue: () => (/* binding */ ViewModelInstanceValue),
/* harmony export */   decodeAudio: () => (/* binding */ decodeAudio),
/* harmony export */   decodeFont: () => (/* binding */ decodeFont),
/* harmony export */   decodeImage: () => (/* binding */ decodeImage)
/* harmony export */ });
/* harmony import */ var _animation__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var _runtimeLoader__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);
/* harmony import */ var _semantics__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(12);
var __extends = (undefined && undefined.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (undefined && undefined.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (undefined && undefined.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};




var RiveError = /** @class */ (function (_super) {
    __extends(RiveError, _super);
    function RiveError() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.isHandledError = true;
        return _this;
    }
    return RiveError;
}(Error));


// #regions helpers
var resolveErrorMessage = function (error) {
    return error && error.isHandledError
        ? error.message
        : "Problem loading file; may be corrupt!";
};
// #region layout
// Fit options for the canvas
var Fit;
(function (Fit) {
    Fit["Cover"] = "cover";
    Fit["Contain"] = "contain";
    Fit["Fill"] = "fill";
    Fit["FitWidth"] = "fitWidth";
    Fit["FitHeight"] = "fitHeight";
    Fit["None"] = "none";
    Fit["ScaleDown"] = "scaleDown";
    Fit["Layout"] = "layout";
})(Fit || (Fit = {}));
// Alignment options for the canvas
var Alignment;
(function (Alignment) {
    Alignment["Center"] = "center";
    Alignment["TopLeft"] = "topLeft";
    Alignment["TopCenter"] = "topCenter";
    Alignment["TopRight"] = "topRight";
    Alignment["CenterLeft"] = "centerLeft";
    Alignment["CenterRight"] = "centerRight";
    Alignment["BottomLeft"] = "bottomLeft";
    Alignment["BottomCenter"] = "bottomCenter";
    Alignment["BottomRight"] = "bottomRight";
})(Alignment || (Alignment = {}));
// Drawing optimization options
var DrawOptimizationOptions;
(function (DrawOptimizationOptions) {
    DrawOptimizationOptions["AlwaysDraw"] = "alwaysDraw";
    DrawOptimizationOptions["DrawOnChanged"] = "drawOnChanged";
})(DrawOptimizationOptions || (DrawOptimizationOptions = {}));
// Alignment options for Rive animations in a HTML canvas
var Layout = /** @class */ (function () {
    function Layout(params) {
        var _a, _b, _c, _d, _e, _f, _g;
        this.fit = (_a = params === null || params === void 0 ? void 0 : params.fit) !== null && _a !== void 0 ? _a : Fit.Contain;
        this.alignment = (_b = params === null || params === void 0 ? void 0 : params.alignment) !== null && _b !== void 0 ? _b : Alignment.Center;
        this.layoutScaleFactor = (_c = params === null || params === void 0 ? void 0 : params.layoutScaleFactor) !== null && _c !== void 0 ? _c : 1;
        this.minX = (_d = params === null || params === void 0 ? void 0 : params.minX) !== null && _d !== void 0 ? _d : 0;
        this.minY = (_e = params === null || params === void 0 ? void 0 : params.minY) !== null && _e !== void 0 ? _e : 0;
        this.maxX = (_f = params === null || params === void 0 ? void 0 : params.maxX) !== null && _f !== void 0 ? _f : 0;
        this.maxY = (_g = params === null || params === void 0 ? void 0 : params.maxY) !== null && _g !== void 0 ? _g : 0;
    }
    // Alternative constructor to build a Layout from an interface/object
    Layout.new = function (_a) {
        var fit = _a.fit, alignment = _a.alignment, minX = _a.minX, minY = _a.minY, maxX = _a.maxX, maxY = _a.maxY;
        warnOnce(DeprecationKeys.legacyConstructors, "This function is deprecated: please use `new Layout({})` instead");
        return new Layout({ fit: fit, alignment: alignment, minX: minX, minY: minY, maxX: maxX, maxY: maxY });
    };
    /**
     * Makes a copy of the layout, replacing any specified parameters
     */
    Layout.prototype.copyWith = function (_a) {
        var fit = _a.fit, alignment = _a.alignment, layoutScaleFactor = _a.layoutScaleFactor, minX = _a.minX, minY = _a.minY, maxX = _a.maxX, maxY = _a.maxY;
        return new Layout({
            fit: fit !== null && fit !== void 0 ? fit : this.fit,
            alignment: alignment !== null && alignment !== void 0 ? alignment : this.alignment,
            layoutScaleFactor: layoutScaleFactor !== null && layoutScaleFactor !== void 0 ? layoutScaleFactor : this.layoutScaleFactor,
            minX: minX !== null && minX !== void 0 ? minX : this.minX,
            minY: minY !== null && minY !== void 0 ? minY : this.minY,
            maxX: maxX !== null && maxX !== void 0 ? maxX : this.maxX,
            maxY: maxY !== null && maxY !== void 0 ? maxY : this.maxY,
        });
    };
    // Returns fit for the Wasm runtime format
    Layout.prototype.runtimeFit = function (rive) {
        if (this.cachedRuntimeFit)
            return this.cachedRuntimeFit;
        var fit;
        if (this.fit === Fit.Cover)
            fit = rive.Fit.cover;
        else if (this.fit === Fit.Contain)
            fit = rive.Fit.contain;
        else if (this.fit === Fit.Fill)
            fit = rive.Fit.fill;
        else if (this.fit === Fit.FitWidth)
            fit = rive.Fit.fitWidth;
        else if (this.fit === Fit.FitHeight)
            fit = rive.Fit.fitHeight;
        else if (this.fit === Fit.ScaleDown)
            fit = rive.Fit.scaleDown;
        else if (this.fit === Fit.Layout)
            fit = rive.Fit.layout;
        else
            fit = rive.Fit.none;
        this.cachedRuntimeFit = fit;
        return fit;
    };
    // Returns alignment for the Wasm runtime format
    Layout.prototype.runtimeAlignment = function (rive) {
        if (this.cachedRuntimeAlignment)
            return this.cachedRuntimeAlignment;
        var alignment;
        if (this.alignment === Alignment.TopLeft)
            alignment = rive.Alignment.topLeft;
        else if (this.alignment === Alignment.TopCenter)
            alignment = rive.Alignment.topCenter;
        else if (this.alignment === Alignment.TopRight)
            alignment = rive.Alignment.topRight;
        else if (this.alignment === Alignment.CenterLeft)
            alignment = rive.Alignment.centerLeft;
        else if (this.alignment === Alignment.CenterRight)
            alignment = rive.Alignment.centerRight;
        else if (this.alignment === Alignment.BottomLeft)
            alignment = rive.Alignment.bottomLeft;
        else if (this.alignment === Alignment.BottomCenter)
            alignment = rive.Alignment.bottomCenter;
        else if (this.alignment === Alignment.BottomRight)
            alignment = rive.Alignment.bottomRight;
        else
            alignment = rive.Alignment.center;
        this.cachedRuntimeAlignment = alignment;
        return alignment;
    };
    return Layout;
}());

// #endregion
// #region runtime

// #endregion
// #region state machines
/**
 * @deprecated State machine inputs are deprecated and will be removed in a
 * future major version: please use data binding properties instead. See
 * {@link https://rive.app/docs/editor/data-binding/migration-guide#state-machine-inputs}
 * for how to migrate.
 */
var StateMachineInputType;
(function (StateMachineInputType) {
    StateMachineInputType[StateMachineInputType["Number"] = 56] = "Number";
    StateMachineInputType[StateMachineInputType["Trigger"] = 58] = "Trigger";
    StateMachineInputType[StateMachineInputType["Boolean"] = 59] = "Boolean";
})(StateMachineInputType || (StateMachineInputType = {}));
/**
 * An input for a state machine
 * @deprecated State machine inputs are deprecated and will be removed in a
 * future major version: please use data binding properties instead. See
 * {@link https://rive.app/docs/editor/data-binding/migration-guide#state-machine-inputs}
 * for how to migrate.
 */
var StateMachineInput = /** @class */ (function () {
    function StateMachineInput(type, runtimeInput) {
        this.type = type;
        this.runtimeInput = runtimeInput;
    }
    Object.defineProperty(StateMachineInput.prototype, "name", {
        /**
         * Returns the name of the input
         */
        get: function () {
            return this.runtimeInput.name;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(StateMachineInput.prototype, "value", {
        /**
         * Returns the current value of the input
         */
        get: function () {
            return this.runtimeInput.value;
        },
        /**
         * Sets the value of the input
         */
        set: function (value) {
            this.runtimeInput.value = value;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Fires a trigger; does nothing on Number or Boolean input types
     */
    StateMachineInput.prototype.fire = function () {
        if (this.type === StateMachineInputType.Trigger) {
            this.runtimeInput.fire();
        }
    };
    /**
     * Deletes the input
     */
    StateMachineInput.prototype.delete = function () {
        this.runtimeInput = null;
    };
    return StateMachineInput;
}());

/**
 * @deprecated Subscribing to Rive Events at runtime is deprecated and will be removed in a future major
 * version: please use data binding instead. See
 * {@link https://rive.app/docs/runtimes/web/rive-events} for how to migrate.
 */
var RiveEventType;
(function (RiveEventType) {
    RiveEventType[RiveEventType["General"] = 128] = "General";
    RiveEventType[RiveEventType["OpenUrl"] = 131] = "OpenUrl";
})(RiveEventType || (RiveEventType = {}));
var BaseArtboard = /** @class */ (function () {
    function BaseArtboard(_isBindableArtboard) {
        this.isBindableArtboard = false;
        this.isBindableArtboard = _isBindableArtboard;
    }
    return BaseArtboard;
}());
var Artboard = /** @class */ (function (_super) {
    __extends(Artboard, _super);
    function Artboard(artboard, _file) {
        var _this = _super.call(this, false) || this;
        _this.nativeArtboard = artboard;
        _this.file = _file;
        return _this;
    }
    return Artboard;
}(BaseArtboard));
var BindableArtboard = /** @class */ (function (_super) {
    __extends(BindableArtboard, _super);
    function BindableArtboard(artboard) {
        var _this = _super.call(this, true) || this;
        _this.selfUnref = false;
        _this.nativeArtboard = artboard;
        return _this;
    }
    Object.defineProperty(BindableArtboard.prototype, "viewModel", {
        set: function (value) {
            this.nativeViewModel = value.nativeInstance;
        },
        enumerable: false,
        configurable: true
    });
    BindableArtboard.prototype.destroy = function () {
        var _a;
        if (this.selfUnref) {
            this.nativeArtboard.unref();
            (_a = this.nativeViewModel) === null || _a === void 0 ? void 0 : _a.unref();
        }
    };
    return BindableArtboard;
}(BaseArtboard));
var StateMachine = /** @class */ (function () {
    /**
     * @constructor
     * @param stateMachine runtime state machine object
     * @param instance runtime state machine instance object
     */
    function StateMachine(stateMachine, runtime, playing, artboard) {
        this.stateMachine = stateMachine;
        this.playing = playing;
        this.artboard = artboard;
        /**
         * Caches the inputs from the runtime
         */
        this.inputs = [];
        this.instance = new runtime.StateMachineInstance(stateMachine, artboard);
        this.initInputs(runtime);
    }
    Object.defineProperty(StateMachine.prototype, "hasFocusNodes", {
        /**
         * Whether this state machine has focus nodes
         */
        get: function () {
            return this.instance.hasFocusNodes();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(StateMachine.prototype, "name", {
        get: function () {
            return this.stateMachine.name;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(StateMachine.prototype, "statesChanged", {
        /**
         * Returns a list of state names that have changed on this frame
         */
        get: function () {
            var names = [];
            for (var i = 0; i < this.instance.stateChangedCount(); i++) {
                names.push(this.instance.stateChangedNameByIndex(i));
            }
            return names;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Advances the state machine instance by a given time.
     * @param time - the time to advance the animation by in seconds
     */
    StateMachine.prototype.advance = function (time) {
        this.instance.advance(time);
    };
    /**
     * Advances the state machine instance by a given time and apply changes to artboard.
     * @param time - the time to advance the animation by in seconds
     */
    StateMachine.prototype.advanceAndApply = function (time) {
        this.instance.advanceAndApply(time);
    };
    /**
     * Enables semantic tree tracking for this state machine instance.
     */
    StateMachine.prototype.enableSemantics = function () {
        this.instance.enableSemantics();
    };
    /**
     * Returns the incremental semantic diff since the last call, or null
     * if semantics is not enabled or nothing changed.
     */
    StateMachine.prototype.drainSemanticsDiff = function () {
        return this.instance.drainSemanticsDiff();
    };
    /**
     * Fire a semantic action (tap, increase, decrease) on a node.
     * @param nodeId - The semantic node ID to target
     * @param actionType - 0 = tap, 1 = increase, 2 = decrease
     */
    StateMachine.prototype.fireSemanticAction = function (nodeId, actionType) {
        this.instance.fireSemanticAction(nodeId, actionType);
    };
    /**
     * When tools that enable accessible experiences traverse elements with focus,
     * we should call this method to focus the semantic node. It will also trigger
     * focus on any Focus listeners for this node
     * @param nodeId ID of the Semantic Node to focus
     * @returns boolean - True if focus was set, false otherwise
     */
    StateMachine.prototype.focusSemanticNode = function (nodeId) {
        return this.instance.focusSemanticNode(nodeId);
    };
    /**
     * Returns the number of events reported from the last advance call
     * @returns Number of events reported
     */
    StateMachine.prototype.reportedEventCount = function () {
        return this.instance.reportedEventCount();
    };
    /**
     * Returns a RiveEvent object emitted from the last advance call at the given index
     * of a list of potentially multiple events. If an event at the index is not found,
     * undefined is returned.
     * @param i index of the event reported in a list of potentially multiple events
     * @returns RiveEvent or extended RiveEvent object returned, or undefined
     */
    StateMachine.prototype.reportedEventAt = function (i) {
        return this.instance.reportedEventAt(i);
    };
    /**
     * Fetches references to the state machine's inputs and caches them
     * @param runtime an instance of the runtime; needed for the SMIInput types
     */
    StateMachine.prototype.initInputs = function (runtime) {
        // Fetch the inputs from the runtime if we don't have them
        for (var i = 0; i < this.instance.inputCount(); i++) {
            var input = this.instance.input(i);
            this.inputs.push(this.mapRuntimeInput(input, runtime));
        }
    };
    /**
     * Maps a runtime input to it's appropriate type
     * @param input
     */
    StateMachine.prototype.mapRuntimeInput = function (input, runtime) {
        if (input.type === runtime.SMIInput.bool) {
            return new StateMachineInput(StateMachineInputType.Boolean, input.asBool());
        }
        else if (input.type === runtime.SMIInput.number) {
            return new StateMachineInput(StateMachineInputType.Number, input.asNumber());
        }
        else if (input.type === runtime.SMIInput.trigger) {
            return new StateMachineInput(StateMachineInputType.Trigger, input.asTrigger());
        }
    };
    /**
     * Deletes the backing Wasm state machine instance; once this is called, this
     * state machine is no more.
     */
    StateMachine.prototype.cleanup = function () {
        this.inputs.forEach(function (input) {
            input.delete();
        });
        this.inputs.length = 0;
        this.instance.delete();
    };
    StateMachine.prototype.bindViewModelInstance = function (viewModelInstance) {
        if (viewModelInstance.runtimeInstance != null) {
            this.instance.bindViewModelInstance(viewModelInstance.runtimeInstance);
        }
    };
    /**
     * Get metadata about the state of focus if applicable for this state machine.
     * @returns FocusState - { hasFocus: boolean, expectsKeyboardInput: boolean }
     */
    StateMachine.prototype.focusState = function () {
        return this.instance.focusState();
    };
    /**
     * Clear focus from the Rive focus node tree.
     */
    StateMachine.prototype.clearFocus = function () {
        this.instance.clearFocus();
    };
    return StateMachine;
}());
// #endregion
// #region animator
/**
 * Manages animation
 */
var Animator = /** @class */ (function () {
    /**
     * Constructs a new animator
     * @constructor
     * @param runtime Rive runtime; needed to instance animations & state machines
     * @param artboard the artboard that holds all animations and state machines
     * @param animations optional list of animations
     * @param stateMachines optional list of state machines
     */
    function Animator(runtime, artboard, eventManager, animations, stateMachines) {
        if (animations === void 0) { animations = []; }
        if (stateMachines === void 0) { stateMachines = []; }
        this.runtime = runtime;
        this.artboard = artboard;
        this.eventManager = eventManager;
        this.animations = animations;
        this.stateMachines = stateMachines;
    }
    /**
     * Adds animations and state machines by their names. If names are shared
     * between animations & state machines, then the first one found will be
     * created. Best not to use the same names for these in your Rive file.
     * @param animatable the name(s) of animations and state machines to add
     * @returns a list of names of the playing animations and state machines
     */
    Animator.prototype.add = function (animatables, playing, fireEvent, semanticsActive) {
        if (fireEvent === void 0) { fireEvent = true; }
        if (semanticsActive === void 0) { semanticsActive = false; }
        animatables = mapToStringArray(animatables);
        // If animatables is empty, play or pause everything
        if (animatables.length === 0) {
            this.animations.forEach(function (a) { return (a.playing = playing); });
            this.stateMachines.forEach(function (m) { return (m.playing = playing); });
        }
        else {
            // Play/pause already instanced items, or create new instances
            var instancedAnimationNames = this.animations.map(function (a) { return a.name; });
            var instancedMachineNames = this.stateMachines.map(function (m) { return m.name; });
            for (var i = 0; i < animatables.length; i++) {
                var aIndex = instancedAnimationNames.indexOf(animatables[i]);
                var mIndex = instancedMachineNames.indexOf(animatables[i]);
                if (aIndex >= 0 || mIndex >= 0) {
                    if (aIndex >= 0) {
                        // Animation is instanced, play/pause it
                        this.animations[aIndex].playing = playing;
                    }
                    else {
                        // State machine is instanced, play/pause it
                        this.stateMachines[mIndex].playing = playing;
                    }
                }
                else {
                    // Try to create a new animation instance
                    var anim = this.artboard.animationByName(animatables[i]);
                    if (anim) {
                        var newAnimation = new _animation__WEBPACK_IMPORTED_MODULE_0__.Animation(anim, this.artboard, this.runtime, playing);
                        // Display the first frame of the specified animation
                        newAnimation.advance(0);
                        newAnimation.apply(1.0);
                        this.animations.push(newAnimation);
                    }
                    else {
                        // Try to create a new state machine instance
                        var sm = this.artboard.stateMachineByName(animatables[i]);
                        if (sm) {
                            var newStateMachine = new StateMachine(sm, this.runtime, playing, this.artboard);
                            if (semanticsActive) {
                                newStateMachine.enableSemantics();
                            }
                            this.stateMachines.push(newStateMachine);
                        }
                    }
                }
            }
        }
        // Fire play/paused events for animations
        if (fireEvent) {
            if (playing) {
                this.eventManager.fire({
                    type: EventType.Play,
                    data: this.playing,
                });
            }
            else {
                this.eventManager.fire({
                    type: EventType.Pause,
                    data: this.paused,
                });
            }
        }
        return playing ? this.playing : this.paused;
    };
    /**
     * Adds linear animations by their names.
     * @param animatables the name(s) of animations to add
     * @param playing whether animations should play on instantiation
     */
    Animator.prototype.initLinearAnimations = function (animatables, playing, isFallingBackFromStateMachines) {
        if (isFallingBackFromStateMachines === void 0) { isFallingBackFromStateMachines = false; }
        // Play/pause already instanced items, or create new instances
        // This validation is kept to maintain compatibility with current behavior.
        // But given that it this is called during artboard initialization
        // it should probably be safe to remove.
        var instancedAnimationNames = this.animations.map(function (a) { return a.name; });
        for (var i = 0; i < animatables.length; i++) {
            var aIndex = instancedAnimationNames.indexOf(animatables[i]);
            if (aIndex >= 0) {
                this.animations[aIndex].playing = playing;
            }
            else {
                // Try to create a new animation instance
                var anim = this.artboard.animationByName(animatables[i]);
                if (anim) {
                    var newAnimation = new _animation__WEBPACK_IMPORTED_MODULE_0__.Animation(anim, this.artboard, this.runtime, playing);
                    // Display the first frame of the specified animation
                    newAnimation.advance(0);
                    newAnimation.apply(1.0);
                    this.animations.push(newAnimation);
                }
                else if (isFallingBackFromStateMachines) { // Throw LoadError if we cannot load the state machine name at all
                    var smInitializationMessage = "State Machine with name ".concat(animatables[i], " not found");
                    throw new RiveError(smInitializationMessage);
                }
                else {
                    console.error("Animation with name ".concat(animatables[i], " not found."));
                }
            }
        }
    };
    /**
     * Adds state machines by their names.
     * @param animatables the name(s) of state machines to add
     * @param playing whether state machines should play on instantiation
     */
    Animator.prototype.initStateMachines = function (animatables, playing, semanticsActive) {
        // Play/pause already instanced items, or create new instances
        // This validation is kept to maintain compatibility with current behavior.
        // But given that it this is called during artboard initialization
        // it should probably be safe to remove.
        var instancedStateMachineNames = this.stateMachines.map(function (a) { return a.name; });
        for (var i = 0; i < animatables.length; i++) {
            var aIndex = instancedStateMachineNames.indexOf(animatables[i]);
            if (aIndex >= 0) {
                this.stateMachines[aIndex].playing = playing;
            }
            else {
                // Try to create a new state machine instance
                var sm = this.artboard.stateMachineByName(animatables[i]);
                if (sm) {
                    var newStateMachine = new StateMachine(sm, this.runtime, playing, this.artboard);
                    if (semanticsActive) {
                        newStateMachine.enableSemantics();
                    }
                    this.stateMachines.push(newStateMachine);
                }
                else {
                    console.warn("State Machine with name ".concat(animatables[i], " not found. Falling back to find an animation with the same name."));
                    // TODO: Remove this fallback in next major release as it complicates initialization.
                    // In order to maintain compatibility with current behavior, if a state machine is not found
                    // we look for an animation with the same name
                    this.initLinearAnimations([animatables[i]], playing, true);
                }
            }
        }
    };
    /**
     * Play the named animations/state machines
     * @param animatables the names of the animations/machines to play; plays all if empty
     * @returns a list of the playing items
     */
    Animator.prototype.play = function (animatables) {
        return this.add(animatables, true);
    };
    /**
     * Advance state machines if they are paused after initialization
     */
    Animator.prototype.advanceIfPaused = function () {
        this.stateMachines.forEach(function (sm) {
            if (!sm.playing) {
                sm.advanceAndApply(0);
            }
        });
    };
    /**
     * Pauses named animations and state machines, or everything if nothing is
     * specified
     * @param animatables names of the animations and state machines to pause
     * @returns a list of names of the animations and state machines paused
     */
    Animator.prototype.pause = function (animatables) {
        return this.add(animatables, false);
    };
    /**
     * Set time of named animations
     * @param animations names of the animations to scrub
     * @param value time scrub value, a floating point number to which the playhead is jumped
     * @returns a list of names of the animations that were scrubbed
     */
    Animator.prototype.scrub = function (animatables, value) {
        var forScrubbing = this.animations.filter(function (a) {
            return animatables.includes(a.name);
        });
        forScrubbing.forEach(function (a) { return (a.scrubTo = value); });
        return forScrubbing.map(function (a) { return a.name; });
    };
    Object.defineProperty(Animator.prototype, "playing", {
        /**
         * Returns a list of names of all animations and state machines currently
         * playing
         */
        get: function () {
            return this.animations
                .filter(function (a) { return a.playing; })
                .map(function (a) { return a.name; })
                .concat(this.stateMachines.filter(function (m) { return m.playing; }).map(function (m) { return m.name; }));
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Animator.prototype, "paused", {
        /**
         * Returns a list of names of all animations and state machines currently
         * paused
         */
        get: function () {
            return this.animations
                .filter(function (a) { return !a.playing; })
                .map(function (a) { return a.name; })
                .concat(this.stateMachines.filter(function (m) { return !m.playing; }).map(function (m) { return m.name; }));
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Stops and removes all named animations and state machines
     * @param animatables animations and state machines to remove
     * @returns a list of names of removed items
     */
    Animator.prototype.stop = function (animatables) {
        var _this = this;
        animatables = mapToStringArray(animatables);
        // If nothing's specified, wipe them out, all of them
        var removedNames = [];
        // Stop everything
        if (animatables.length === 0) {
            removedNames = this.animations
                .map(function (a) { return a.name; })
                .concat(this.stateMachines.map(function (m) { return m.name; }));
            // Clean up before emptying the arrays
            this.animations.forEach(function (a) { return a.cleanup(); });
            this.stateMachines.forEach(function (m) { return m.cleanup(); });
            // Empty out the arrays
            this.animations.splice(0, this.animations.length);
            this.stateMachines.splice(0, this.stateMachines.length);
        }
        else {
            // Remove only the named animations/state machines
            var animationsToRemove = this.animations.filter(function (a) {
                return animatables.includes(a.name);
            });
            animationsToRemove.forEach(function (a) {
                a.cleanup();
                _this.animations.splice(_this.animations.indexOf(a), 1);
            });
            var machinesToRemove = this.stateMachines.filter(function (m) {
                return animatables.includes(m.name);
            });
            machinesToRemove.forEach(function (m) {
                m.cleanup();
                _this.stateMachines.splice(_this.stateMachines.indexOf(m), 1);
            });
            removedNames = animationsToRemove
                .map(function (a) { return a.name; })
                .concat(machinesToRemove.map(function (m) { return m.name; }));
        }
        this.eventManager.fire({
            type: EventType.Stop,
            data: removedNames,
        });
        // Return the list of animations removed
        return removedNames;
    };
    Object.defineProperty(Animator.prototype, "isPlaying", {
        /**
         * Returns true if at least one animation is active
         */
        get: function () {
            return (this.animations.reduce(function (acc, curr) { return acc || curr.playing; }, false) ||
                this.stateMachines.reduce(function (acc, curr) { return acc || curr.playing; }, false));
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Animator.prototype, "isPaused", {
        /**
         * Returns true if all animations are paused and there's at least one animation
         */
        get: function () {
            return (!this.isPlaying &&
                (this.animations.length > 0 || this.stateMachines.length > 0));
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Animator.prototype, "isStopped", {
        /**
         * Returns true if there are no playing or paused animations/state machines
         */
        get: function () {
            return this.animations.length === 0 && this.stateMachines.length === 0;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * If there are no animations or state machines, add the first one found
     * @returns the name of the animation or state machine instanced
     */
    Animator.prototype.atLeastOne = function (playing, fireEvent, semanticsActive) {
        if (fireEvent === void 0) { fireEvent = true; }
        if (semanticsActive === void 0) { semanticsActive = false; }
        var instancedName;
        if (this.animations.length === 0 && this.stateMachines.length === 0) {
            if (this.artboard.animationCount() > 0) {
                // Warn only when the v3 default would actually change what plays
                if (this.artboard.stateMachineCount() > 0) {
                    warnOnce(DeprecationKeys.defaultStateMachine, "No `stateMachine` was specified, so the artboard's first linear animation is playing by default. " +
                        "In the next major version, the artboard's state machine will be played by default instead when one exists. " +
                        "Pass the `stateMachine` parameter to adopt that behavior now.");
                }
                // Add the first animation
                this.add([(instancedName = this.artboard.animationByIndex(0).name)], playing, fireEvent);
            }
            else if (this.artboard.stateMachineCount() > 0) {
                // Add the first state machine
                this.add([(instancedName = this.artboard.stateMachineByIndex(0).name)], playing, fireEvent, semanticsActive);
            }
        }
        return instancedName;
    };
    /**
     * Checks if any animations have looped and if so, fire the appropriate event
     */
    Animator.prototype.handleLooping = function () {
        for (var _i = 0, _a = this.animations.filter(function (a) { return a.playing; }); _i < _a.length; _i++) {
            var animation = _a[_i];
            // Emit if the animation looped
            if (animation.loopValue === 0 && animation.loopCount) {
                animation.loopCount = 0;
                // This is a one-shot; if it has ended, delete the instance
                this.stop(animation.name);
            }
            else if (animation.loopValue === 1 && animation.loopCount) {
                this.eventManager.fire({
                    type: EventType.Loop,
                    data: { animation: animation.name, type: LoopType.Loop },
                });
                animation.loopCount = 0;
            }
            // Wasm indicates a loop at each time the animation
            // changes direction, so a full loop/lap occurs every
            // two loop counts
            else if (animation.loopValue === 2 && animation.loopCount > 1) {
                this.eventManager.fire({
                    type: EventType.Loop,
                    data: { animation: animation.name, type: LoopType.PingPong },
                });
                animation.loopCount = 0;
            }
        }
    };
    /**
     * Checks if states have changed in state machines and fires a statechange
     * event
     */
    Animator.prototype.handleStateChanges = function () {
        var statesChanged = [];
        for (var _i = 0, _a = this.stateMachines.filter(function (sm) { return sm.playing; }); _i < _a.length; _i++) {
            var stateMachine = _a[_i];
            statesChanged.push.apply(statesChanged, stateMachine.statesChanged);
        }
        if (statesChanged.length > 0) {
            this.eventManager.fire({
                type: EventType.StateChange,
                data: statesChanged,
            });
        }
    };
    Animator.prototype.handleAdvancing = function (time) {
        this.eventManager.fire({
            type: EventType.Advance,
            data: time,
        });
    };
    return Animator;
}());
// #endregion
// #region events
/**
 * Supported event types triggered in Rive
 */
var EventType;
(function (EventType) {
    EventType["Load"] = "load";
    EventType["LoadError"] = "loaderror";
    EventType["Play"] = "play";
    EventType["Pause"] = "pause";
    EventType["Stop"] = "stop";
    /**
     * @deprecated Loop events are deprecated and will be removed in a future
     * major version: they are only reported for linear animation playback, which
     * is deprecated. Use a state machine to control playback and data binding to
     * react to changes instead. See
     * {@link https://rive.app/docs/editor/data-binding/migration-guide} for how
     * to migrate.
     */
    EventType["Loop"] = "loop";
    EventType["Draw"] = "draw";
    EventType["Advance"] = "advance";
    /**
     * @deprecated Subscribing to state change events at runtime is deprecated
     * and will be removed in a future major version: use data binding (view model
     * property observers) or state machine actions to react to changes from your
     * graphic instead. See
     * {@link https://rive.app/docs/editor/state-machine/states#actions} for more details.
     */
    EventType["StateChange"] = "statechange";
    /**
     * @deprecated Subscribing to Rive Events at runtime is deprecated and will be removed in a future
     * major version: please use data binding instead. See
     * {@link https://rive.app/docs/runtimes/web/rive-events} for how to migrate.
     */
    EventType["RiveEvent"] = "riveevent";
    EventType["AudioStatusChange"] = "audiostatuschange";
})(EventType || (EventType = {}));
var riveEventsDeprecationWarning = "Subscribing to Rive Events at runtime is deprecated and will be removed in a future major version: " +
    "please use data binding instead. See " +
    "https://rive.app/docs/runtimes/web/rive-events for how to migrate.";
var stateMachineInputsDeprecationWarning = "State machine inputs are deprecated and will be removed in a future major version: " +
    "please use data binding properties instead. See " +
    "https://rive.app/docs/editor/data-binding/migration-guide#state-machine-inputs for how to migrate.";
var textRunsDeprecationWarning = "Text run APIs are deprecated and will be removed in a future major version: " +
    "please use data binding instead. See " +
    "https://rive.app/docs/editor/data-binding/migration-guide#updating-text-runs-at-runtime for how to migrate.";
var loopEventsDeprecationWarning = "Loop events are deprecated and will be removed in a future major version: " +
    "they are only reported for linear animation playback, which is deprecated. " +
    "Use a state machine to control playback and data binding to react to changes instead. See " +
    "https://rive.app/docs/editor/data-binding/migration-guide for how to migrate.";
var stateChangeEventsDeprecationWarning = "Subscribing to state change events at runtime is deprecated and will be removed in a future major version: " +
    "use data binding (view model property observers) or state machine actions to react to " +
    "changes from your graphic instead. See " +
    "https://rive.app/docs/editor/state-machine/states#actions for how to migrate.";
/**
 * The deprecations this runtime warns about. Each warning prints its own id, so
 * the value can be copied straight out of the console into
 * {@link Rive.suppressDeprecationWarnings}.
 */
var DeprecationKeys = {
    animationNames: "animation-names",
    animationsParam: "animations-param",
    defaultStateMachine: "default-state-machine",
    legacyConstructors: "legacy-constructors",
    legacyUnsubscribe: "legacy-unsubscribe",
    loopEvents: "loop-events",
    namesArray: "names-array",
    riveEvents: "rive-events",
    scrub: "scrub",
    stateChangeEvents: "state-change-events",
    stateMachineInputs: "state-machine-inputs",
    stateMachinesParam: "state-machines-param",
    textRuns: "text-runs",
};
// Derived from `DeprecationKeys`
var deprecationIds = new Set(Object.keys(DeprecationKeys).map(function (name) { return DeprecationKeys[name]; }));
// Deprecations that a consumer has opted out of. Kept at module scope so
// `warnOnce` can read it without referencing the `Rive` class
var suppressedDeprecations = new Set();
/** @internal Backing store for `Rive.suppressDeprecationWarnings`. */
var setSuppressedDeprecations = function (ids) {
    suppressedDeprecations.clear();
    if (!Array.isArray(ids)) {
        console.warn("[Rive] `suppressDeprecationWarnings` expects an array of deprecation ids, " +
            "received ".concat(typeof ids, ". Nothing was suppressed."));
        return;
    }
    for (var _i = 0, ids_1 = ids; _i < ids_1.length; _i++) {
        var id = ids_1[_i];
        if (deprecationIds.has(id)) {
            suppressedDeprecations.add(id);
        }
    }
};
// Deprecation warnings already emitted; each is logged at most once per page
// session to avoid flooding the console when many instances are created.
var emittedWarnings = new Set();
/**
 * Logs a deprecation warning at most once per page session, unless its id has
 * been passed to `Rive.suppressDeprecationWarnings`.
 */
var warnOnce = function (id, message) {
    if (suppressedDeprecations.has(id)) {
        return;
    }
    var key = "".concat(id, ":").concat(message);
    if (emittedWarnings.has(key)) {
        return;
    }
    emittedWarnings.add(key);
    console.warn("[Rive: ".concat(id, "] ").concat(message, "\n") +
        "To suppress this warning, set Rive.suppressDeprecationWarnings = [\"".concat(id, "\"]"));
};
/**
 * Warns that a playback-control method received an array of names; the next
 * major version restricts these parameters to a single string, since playing
 * multiple animations or state machines at once will not be supported.
 */
var warnIfNamesArray = function (names, methodName) {
    if (Array.isArray(names)) {
        warnOnce(DeprecationKeys.namesArray, "Passing an array of names to `".concat(methodName, "()` is deprecated: in the next major version this parameter will be a single string, and playing multiple animations or state machines at once will not be supported."));
    }
};
/**
 * Warns that a playback-control method received linear animation names;
 * name-based control remains supported for state machines only, so
 * user-specified linear animation names are going away in a future major
 * version.
 */
var warnDeprecatedAnimationNames = function (methodName) {
    warnOnce(DeprecationKeys.animationNames, "Passing linear animation names to `".concat(methodName, "()` is deprecated and will be removed in a future major version: ") +
        "Pass a single state machine name to control playback instead.");
};
/**
 * Looping types: one-shot, loop, and ping-pong
 * @deprecated Loop events are deprecated and will be removed in a future major
 * version: they are only reported for linear animation playback, which is
 * deprecated. Use a state machine to control playback and data binding to
 * react to changes instead.
 */
var LoopType;
(function (LoopType) {
    LoopType["OneShot"] = "oneshot";
    LoopType["Loop"] = "loop";
    LoopType["PingPong"] = "pingpong";
})(LoopType || (LoopType = {}));
// Manages Rive events and listeners
var EventManager = /** @class */ (function () {
    function EventManager(listeners) {
        if (listeners === void 0) { listeners = []; }
        this.listeners = listeners;
    }
    // Gets listeners of specified type
    EventManager.prototype.getListeners = function (type) {
        return this.listeners.filter(function (e) { return e.type === type; });
    };
    // Adds a listener
    EventManager.prototype.add = function (listener) {
        if (!this.listeners.includes(listener)) {
            this.listeners.push(listener);
        }
    };
    /**
     * Removes a listener
     * @param listener the listener with the callback to be removed
     */
    EventManager.prototype.remove = function (listener) {
        // We can't simply look for the listener as it'll be a different instance to
        // one originally subscribed. Find all the listeners of the right type and
        // then check their callbacks which should match.
        for (var i = 0; i < this.listeners.length; i++) {
            var currentListener = this.listeners[i];
            if (currentListener.type === listener.type) {
                if (currentListener.callback === listener.callback) {
                    this.listeners.splice(i, 1);
                    break;
                }
            }
        }
    };
    /**
     * Clears all listeners of specified type, or every listener if no type is
     * specified
     * @param type the type of listeners to clear, or all listeners if not
     * specified
     */
    EventManager.prototype.removeAll = function (type) {
        var _this = this;
        if (!type) {
            this.listeners.splice(0, this.listeners.length);
        }
        else {
            this.listeners
                .filter(function (l) { return l.type === type; })
                .forEach(function (l) { return _this.remove(l); });
        }
    };
    // Fires an event
    EventManager.prototype.fire = function (event) {
        var eventListeners = this.getListeners(event.type);
        eventListeners.forEach(function (listener) { return listener.callback(event); });
    };
    return EventManager;
}());
// Manages a queue of tasks
var TaskQueueManager = /** @class */ (function () {
    function TaskQueueManager(eventManager) {
        this.eventManager = eventManager;
        this.queue = [];
    }
    // Adds a task top the queue
    TaskQueueManager.prototype.add = function (task) {
        this.queue.push(task);
    };
    // Processes all tasks in the queue
    TaskQueueManager.prototype.process = function () {
        while (this.queue.length > 0) {
            var task = this.queue.shift();
            if (task === null || task === void 0 ? void 0 : task.action) {
                task.action();
            }
            if (task === null || task === void 0 ? void 0 : task.event) {
                this.eventManager.fire(task.event);
            }
        }
    };
    return TaskQueueManager;
}());
// #endregion
// #region Audio
var SystemAudioStatus;
(function (SystemAudioStatus) {
    SystemAudioStatus[SystemAudioStatus["AVAILABLE"] = 0] = "AVAILABLE";
    SystemAudioStatus[SystemAudioStatus["UNAVAILABLE"] = 1] = "UNAVAILABLE";
})(SystemAudioStatus || (SystemAudioStatus = {}));
// Class to handle audio context availability and status changes
var AudioManager = /** @class */ (function (_super) {
    __extends(AudioManager, _super);
    function AudioManager() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this._started = false;
        _this._enabled = false;
        _this._status = SystemAudioStatus.UNAVAILABLE;
        return _this;
    }
    AudioManager.prototype.delay = function (time) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) { return setTimeout(resolve, time); })];
            });
        });
    };
    AudioManager.prototype.timeout = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (_, reject) { return setTimeout(reject, 50); })];
            });
        });
    };
    // Alerts animations on status changes and removes the listeners to avoid alerting twice.
    AudioManager.prototype.reportToListeners = function () {
        this.fire({ type: EventType.AudioStatusChange });
        this.removeAll();
    };
    /**
     * The audio context has been resolved.
     * Alert any listeners that we can now play audio.
     * Rive will now play audio at the configured volume.
     */
    AudioManager.prototype.enableAudio = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!this._enabled) {
                    this._enabled = true;
                    this._status = SystemAudioStatus.AVAILABLE;
                    this.reportToListeners();
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check if we are able to play audio.
     *
     * We currently check the audio context, when resume() returns before a timeout we know that the
     * audio context is running and we can enable audio.
     */
    AudioManager.prototype.testAudio = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(this._status === SystemAudioStatus.UNAVAILABLE &&
                            this._audioContext !== null)) return [3 /*break*/, 4];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, Promise.race([this._audioContext.resume(), this.timeout()])];
                    case 2:
                        _b.sent();
                        this.enableAudio();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Establish audio for use with rive.
     * We both test if we can use audio intermittently and listen for user interaction.
     * The aim is to enable audio playback as soon as the browser allows this.
     */
    AudioManager.prototype._establishAudio = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this._started) return [3 /*break*/, 5];
                        this._started = true;
                        if (!(typeof window == "undefined")) return [3 /*break*/, 1];
                        this.enableAudio();
                        return [3 /*break*/, 5];
                    case 1:
                        this._audioContext = new AudioContext();
                        this.listenForUserAction();
                        _a.label = 2;
                    case 2:
                        if (!(this._status === SystemAudioStatus.UNAVAILABLE)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.testAudio()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.delay(1000)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    AudioManager.prototype.listenForUserAction = function () {
        var _this = this;
        // NOTE: AudioContexts are ready immediately if requested in a ui callback
        // we *could* re request one in this listener.
        var _clickListener = function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // note this has "better" results than calling `await this.testAudio()`
                // as we force audio to be enabled in the current thread, rather than chancing
                // the thread to be passed over for some other async context
                this.enableAudio();
                return [2 /*return*/];
            });
        }); };
        // NOTE: we should test this on mobile/pads
        document.addEventListener("pointerdown", _clickListener, {
            once: true,
        });
    };
    /**
     * Establish the audio context for rive, this lets rive know that we can play audio.
     */
    AudioManager.prototype.establishAudio = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this._establishAudio();
                return [2 /*return*/];
            });
        });
    };
    Object.defineProperty(AudioManager.prototype, "systemVolume", {
        get: function () {
            if (this._status === SystemAudioStatus.UNAVAILABLE) {
                // We do an immediate test to avoid depending on the delay of the running test
                this.testAudio();
                return 0;
            }
            return 1;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AudioManager.prototype, "status", {
        get: function () {
            return this._status;
        },
        enumerable: false,
        configurable: true
    });
    return AudioManager;
}(EventManager));
var audioManager = new AudioManager();
var FakeResizeObserver = /** @class */ (function () {
    function FakeResizeObserver() {
    }
    FakeResizeObserver.prototype.observe = function () { };
    FakeResizeObserver.prototype.unobserve = function () { };
    FakeResizeObserver.prototype.disconnect = function () { };
    return FakeResizeObserver;
}());
var MyResizeObserver = globalThis.ResizeObserver || FakeResizeObserver;
/**
 * This class takes care of any observers that will be attached to an animation.
 * It should be treated as a singleton because observers are much more performant
 * when used for observing multiple elements by a single instance.
 */
var ObjectObservers = /** @class */ (function () {
    function ObjectObservers() {
        var _this = this;
        this._elementsMap = new Map();
        /**
         * Resize observers trigger both when the element changes its size and also when the
         * element is added or removed from the document.
         */
        this._onObservedEntry = function (entry) {
            var observed = _this._elementsMap.get(entry.target);
            if (observed !== null) {
                observed.onResize(entry.target.clientWidth == 0 || entry.target.clientHeight == 0);
            }
            else {
                _this._resizeObserver.unobserve(entry.target);
            }
        };
        this._onObserved = function (entries) {
            entries.forEach(_this._onObservedEntry);
        };
        this._resizeObserver = new MyResizeObserver(this._onObserved);
    }
    // Adds an observable element
    ObjectObservers.prototype.add = function (element, onResize) {
        var observed = {
            onResize: onResize,
            element: element,
        };
        this._elementsMap.set(element, observed);
        this._resizeObserver.observe(element);
        return observed;
    };
    // Removes an observable element
    ObjectObservers.prototype.remove = function (observed) {
        this._resizeObserver.unobserve(observed.element);
        this._elementsMap.delete(observed.element);
    };
    return ObjectObservers;
}());
var observers = new ObjectObservers();
// #endregion
// #region Rive
var nextRiveInstanceId = 0;
/**
 * Resolves which animation/state machine names playback should start with.
 * The `stateMachine` parameter takes priority; the deprecated plural
 * `animations`/`stateMachines` parameters apply only when it
 * is not provided.
 */
var resolveStartingPlayback = function (_a) {
    var stateMachine = _a.stateMachine, animations = _a.animations, stateMachines = _a.stateMachines;
    if (animations !== undefined) {
        warnOnce(DeprecationKeys.animationsParam, "The `animations` parameter is deprecated and will be removed in a future major version: please use the `stateMachine` parameter to play a state machine instead.");
    }
    if (stateMachines !== undefined) {
        warnOnce(DeprecationKeys.stateMachinesParam, "The `stateMachines` parameter is deprecated: please use `stateMachine` with a single state machine name instead.");
    }
    if (stateMachine) {
        return {
            startingAnimationNames: [],
            startingStateMachineNames: [stateMachine],
        };
    }
    return {
        startingAnimationNames: mapToStringArray(animations),
        startingStateMachineNames: mapToStringArray(stateMachines),
    };
};
var RiveFile = /** @class */ (function () {
    function RiveFile(params) {
        // Allow the runtime to automatically load assets hosted in Rive's runtime.
        this.enableRiveAssetCDN = true;
        // When true, emits performance.mark/measure entries during RiveFile load.
        this.enablePerfMarks = false;
        this.referenceCount = 0;
        this.destroyed = false;
        this.selfUnref = false;
        this.bindableArtboards = [];
        // Deferred rendering was requested; the session may still be null if this
        // build has no deferred support.
        this.deferred = false;
        // The session this file imported through, null when immediate. Owned here:
        // it has to outlive the file, so it is deleted after the file is released.
        this.session = null;
        // Attaching is once per session: a detached session can never replay again,
        // so a claimed file re-imports for the next instance implicitly. Mirrors the native
        // latch (WebGL2DeferredSession::everBound, C2DDeferredSession::claim).
        this._sessionClaimed = false;
        // Releasing this file has to be deterministic once a session owns its
        // resources, so the finalizer is disarmed rather than left to GC.
        this.fileFinalizer = null;
        this.boundElsewhereWarned = false;
        this.src = params.src;
        this.buffer = params.buffer;
        this.deferred = !!params.enableGPUCanvas;
        if (params.assetLoader)
            this.assetLoader = params.assetLoader;
        this.enableRiveAssetCDN =
            typeof params.enableRiveAssetCDN == "boolean"
                ? params.enableRiveAssetCDN
                : true;
        this.enablePerfMarks = !!params.enablePerfMarks;
        if (this.enablePerfMarks)
            _runtimeLoader__WEBPACK_IMPORTED_MODULE_1__.RuntimeLoader.enablePerfMarks = true;
        // New event management system
        this.eventManager = new EventManager();
        if (params.onLoad)
            this.on(EventType.Load, params.onLoad);
        if (params.onLoadError)
            this.on(EventType.LoadError, params.onLoadError);
    }
    RiveFile.prototype.releaseFile = function () {
        var _a, _b;
        // Release here rather than leaving it to the finalization registry. The
        // native file frees GL-backed resources when its last reference goes, and
        // callers reach this with the renderer's context current; a finalizer runs
        // with none, so those deletes would silently do nothing.
        (_a = this.fileFinalizer) === null || _a === void 0 ? void 0 : _a.release();
        (_b = this.file) === null || _b === void 0 ? void 0 : _b.unref();
        this.fileFinalizer = null;
        this.file = null;
    };
    RiveFile.prototype.releaseSession = function () {
        var _a;
        // Known limitation: cleanup() on a file an instance is still drawing
        // deletes the session under it. A RiveFile's creator holds no reference of
        // its own, so their cleanup() can take the count to zero.
        (_a = this.session) === null || _a === void 0 ? void 0 : _a.delete();
        this.session = null;
    };
    RiveFile.prototype.releaseBindableArtboards = function () {
        this.bindableArtboards.forEach(function (bindableArtboard) {
            return bindableArtboard.destroy();
        });
    };
    RiveFile.prototype.initData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_1, loader, loaderWrapper, _b, error_2, fileFinalizer;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!(this.src && !this.buffer)) return [3 /*break*/, 4];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        _a = this;
                        return [4 /*yield*/, loadRiveFile(this.src)];
                    case 2:
                        _a.buffer = _c.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _c.sent();
                        if (error_1 instanceof Error) {
                            throw error_1;
                        }
                        throw new RiveError(RiveFile.fileLoadErrorMessage);
                    case 4:
                        if (this.destroyed) {
                            return [2 /*return*/];
                        }
                        if (this.deferred && this.session === null) {
                            this.session = RiveFile.makeDeferredSession(this.runtime);
                        }
                        if (this.assetLoader) {
                            loaderWrapper = new _utils__WEBPACK_IMPORTED_MODULE_3__.CustomFileAssetLoaderWrapper(this.runtime, this.assetLoader, this.session);
                            loader = loaderWrapper.assetLoader;
                        }
                        // Load the Rive file
                        if (this.enablePerfMarks)
                            performance.mark('rive:file-load:start');
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        _b = this;
                        return [4 /*yield*/, this.runtime.load(new Uint8Array(this.buffer), loader, this.enableRiveAssetCDN, this.session)];
                    case 6:
                        _b.file = _c.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        error_2 = _c.sent();
                        // The finalizer that would reclaim the session is only registered once
                        // the import succeeds, so a failed load has to release it here.
                        this.releaseSession();
                        throw error_2;
                    case 8:
                        if (this.enablePerfMarks) {
                            performance.mark('rive:file-load:end');
                            performance.measure('rive:file-load', 'rive:file-load:start', 'rive:file-load:end');
                        }
                        if (this.destroyed) {
                            this.releaseFile();
                            this.releaseSession();
                            return [2 /*return*/];
                        }
                        if (this.file === null) {
                            // A malformed file resolves to null rather than rejecting. Release the
                            // session now: a finalizer for a file that does not exist would keep it
                            // alive until GC, or for as long as the caller holds the failed RiveFile.
                            this.releaseSession();
                            this.fireLoadError(RiveFile.fileLoadErrorMessage);
                            return [2 /*return*/];
                        }
                        fileFinalizer = new _utils__WEBPACK_IMPORTED_MODULE_3__.FileFinalizer(this.file, this.session);
                        this.fileFinalizer = fileFinalizer;
                        _utils__WEBPACK_IMPORTED_MODULE_3__.finalizationRegistry.register(this, fileFinalizer);
                        this.eventManager.fire({
                            type: EventType.Load,
                            data: this,
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    RiveFile.prototype.loadRiveFileBytes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var bufferPromise;
            return __generator(this, function (_a) {
                if (this.enablePerfMarks)
                    performance.mark('rive:fetch-riv:start');
                bufferPromise = this.src
                    ? loadRiveFile(this.src)
                    : Promise.resolve(this.buffer);
                if (this.enablePerfMarks && this.src) {
                    bufferPromise.then(function () {
                        performance.mark('rive:fetch-riv:end');
                        performance.measure('rive:fetch-riv', 'rive:fetch-riv:start', 'rive:fetch-riv:end');
                    });
                }
                return [2 /*return*/, bufferPromise];
            });
        });
    };
    RiveFile.prototype.loadRuntime = function () {
        return __awaiter(this, void 0, void 0, function () {
            var runtimePromise;
            return __generator(this, function (_a) {
                if (this.enablePerfMarks)
                    performance.mark('rive:await-wasm:start');
                runtimePromise = _runtimeLoader__WEBPACK_IMPORTED_MODULE_1__.RuntimeLoader.awaitInstance();
                if (this.enablePerfMarks) {
                    runtimePromise.then(function () {
                        performance.mark('rive:await-wasm:end');
                        performance.measure('rive:await-wasm', 'rive:await-wasm:start', 'rive:await-wasm:end');
                    });
                }
                return [2 /*return*/, runtimePromise];
            });
        });
    };
    RiveFile.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, bufferResolved, runtimeResolved, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        // If no source file url specified, it's a bust
                        if (!this.src && !this.buffer) {
                            this.fireLoadError(RiveFile.missingErrorMessage);
                            return [2 /*return*/];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, Promise.all([this.loadRiveFileBytes(), this.loadRuntime()])];
                    case 2:
                        _a = _b.sent(), bufferResolved = _a[0], runtimeResolved = _a[1];
                        if (this.destroyed) {
                            return [2 /*return*/];
                        }
                        // .riv file buffer and WASM runtime instance
                        this.buffer = bufferResolved;
                        this.runtime = runtimeResolved;
                        if (this.enablePerfMarks)
                            performance.mark('rive:init-data:start');
                        return [4 /*yield*/, this.initData()];
                    case 3:
                        _b.sent();
                        if (this.enablePerfMarks) {
                            performance.mark('rive:init-data:end');
                            performance.measure('rive:init-data', 'rive:init-data:start', 'rive:init-data:end');
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _b.sent();
                        this.fireLoadError(error_3 instanceof Error ? error_3.message : RiveFile.fileLoadErrorMessage);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    RiveFile.prototype.fireLoadError = function (message) {
        this.eventManager.fire({
            type: EventType.LoadError,
            data: message,
        });
        throw new RiveError(message);
    };
    /**
     * Subscribe to Rive-generated events
     * @param type the type of event to subscribe to
     * @param callback callback to fire when the event occurs
     */
    RiveFile.prototype.on = function (type, callback) {
        this.eventManager.add({
            type: type,
            callback: callback,
        });
    };
    /**
     * Unsubscribes from a Rive-generated event
     * @param type the type of event to unsubscribe from
     * @param callback the callback to unsubscribe
     */
    RiveFile.prototype.off = function (type, callback) {
        this.eventManager.remove({
            type: type,
            callback: callback,
        });
    };
    RiveFile.prototype.cleanup = function () {
        this.referenceCount -= 1;
        if (this.referenceCount <= 0) {
            this.removeAllRiveEventListeners();
            this.releaseFile();
            this.releaseBindableArtboards();
            // Everything imported through the session is gone; the session can go.
            this.releaseSession();
            this.destroyed = true;
        }
    };
    // Deferred is only compiled into some runtime builds, so feature detect it
    // and degrade to an immediate import rather than failing the load.
    RiveFile.makeDeferredSession = function (runtime) {
        var _a, _b;
        var session = (_b = (_a = runtime.makeDeferredSession) === null || _a === void 0 ? void 0 : _a.call(runtime)) !== null && _b !== void 0 ? _b : null;
        if (session === null && !RiveFile.deferredUnsupportedWarned) {
            RiveFile.deferredUnsupportedWarned = true;
            console.warn("Rive: `enableGPUCanvas: true` was ignored because this runtime build has no GPU Canvas support; importing in immediate mode. Use a @rive-app/webgl2 or @rive-app/canvas build with deferred rendering compiled in.");
        }
        return session;
    };
    Object.defineProperty(RiveFile.prototype, "deferredSession", {
        /**
         * @internal The deferred session this file imported through, or null if it
         * was imported in immediate mode.
         */
        get: function () {
            return this.session;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RiveFile.prototype, "deferredRequested", {
        /**
         * @internal Whether deferred was asked for, even when this build could not
         * honor it and imported immediate.
         */
        get: function () {
            return this.deferred;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RiveFile.prototype, "sessionClaimed", {
        /**
         * @internal Whether this file's session has ever been attached to a renderer.
         * Attaching is once per session, so a claimed file re-imports for the next
         * instance even after the renderer it was bound to is gone.
         */
        get: function () {
            return this._sessionClaimed;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * @internal Marks this file's session as spent. There is no matching release:
     * a session that has been attached can never replay for another renderer.
     */
    RiveFile.prototype.claimSession = function () {
        this._sessionClaimed = true;
    };
    /**
     * @internal One warning per file however many instances collide on it.
     */
    RiveFile.prototype.warnBoundElsewhereOnce = function () {
        if (this.boundElsewhereWarned) {
            return;
        }
        this.boundElsewhereWarned = true;
        console.warn("Rive: this deferred RiveFile is already bound to another Rive instance's canvas, and a deferred session cannot span canvases. Re-importing the file for this instance (an extra parse of the retained buffer, no extra network request).");
    };
    /**
     * @internal Re-imports this file from its retained buffer into a mode of its
     * own. The copy is owned by whoever asked for it and never joins this file's
     * reference count.
     */
    RiveFile.prototype.reimport = function (deferred) {
        return __awaiter(this, void 0, void 0, function () {
            var copy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        copy = new RiveFile({
                            buffer: this.buffer,
                            assetLoader: this.assetLoader,
                            enableRiveAssetCDN: this.enableRiveAssetCDN,
                            enablePerfMarks: this.enablePerfMarks,
                            enableGPUCanvas: deferred,
                        });
                        return [4 /*yield*/, copy.init()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, copy];
                }
            });
        });
    };
    /**
     * Unsubscribes all Rive listeners from an event type, or everything if no type is
     * given
     * @param type the type of event to unsubscribe from, or all types if
     * undefined
     */
    RiveFile.prototype.removeAllRiveEventListeners = function (type) {
        this.eventManager.removeAll(type);
    };
    RiveFile.prototype.getInstance = function () {
        if (this.file !== null) {
            this.referenceCount += 1;
            return this.file;
        }
    };
    RiveFile.prototype.destroyIfUnused = function () {
        if (this.referenceCount <= 0) {
            this.cleanup();
        }
    };
    RiveFile.prototype.createBindableArtboard = function (nativeBindableArtboard) {
        if (nativeBindableArtboard != null) {
            var bindableArtboard = new BindableArtboard(nativeBindableArtboard);
            (0,_utils__WEBPACK_IMPORTED_MODULE_3__.createFinalization)(bindableArtboard, bindableArtboard.nativeArtboard);
            this.bindableArtboards.push(bindableArtboard);
            return bindableArtboard;
        }
        return null;
    };
    /**
     * @deprecated This function is deprecated. For better stability and memory management
     * use `getBindableArtboard()` instead.
     * @param {string} name - The name of the artboard.
     * @returns {Artboard} The artboard to bind to.
     */
    RiveFile.prototype.getArtboard = function (name) {
        var nativeArtboard = this.file.artboardByName(name);
        if (nativeArtboard != null) {
            return new Artboard(nativeArtboard, this);
        }
    };
    RiveFile.prototype.getBindableArtboard = function (name) {
        var nativeArtboard = this.file.bindableArtboardByName(name);
        return this.createBindableArtboard(nativeArtboard);
    };
    RiveFile.prototype.getDefaultBindableArtboard = function () {
        var nativeArtboard = this.file.bindableArtboardDefault();
        return this.createBindableArtboard(nativeArtboard);
    };
    RiveFile.prototype.internalBindableArtboardFromArtboard = function (artboard) {
        var nativeBindableArtboard = this.file.internalBindableArtboardFromArtboard(artboard);
        return this.createBindableArtboard(nativeBindableArtboard);
    };
    RiveFile.prototype.viewModelByName = function (name) {
        var viewModel = this.file.viewModelByName(name);
        if (viewModel !== null) {
            return new ViewModel(viewModel);
        }
        return null;
    };
    /**
     * @returns the names of the file's global view models, in file order.
     */
    RiveFile.prototype.globalViewModelNames = function () {
        return this.file.globalViewModelNames();
    };
    // Error message for missing source or buffer
    RiveFile.missingErrorMessage = "Rive source file or data buffer required";
    // Error message for file load error
    RiveFile.fileLoadErrorMessage = "The file failed to load";
    // Deferred support is per build, so the warning is per page, not per file.
    RiveFile.deferredUnsupportedWarned = false;
    return RiveFile;
}());

var Rive = /** @class */ (function () {
    function Rive(params) {
        var _this = this;
        var _a, _b, _c, _d;
        // Tracks if a Rive file is loaded
        this.loaded = false;
        // Tracks if a Rive file is destroyed
        this.destroyed = false;
        // Reference of an object that handles any observers for the animation
        this._observed = null;
        /**
         * Tracks if a Rive file is loaded; we need this in addition to loaded as some
         * commands (e.g. contents) can be called as soon as the file is loaded.
         * However, playback commands need to be queued and run in order once initial
         * animations and autoplay has been sorted out. This applies to play, pause,
         * and start.
         */
        this.readyForPlaying = false;
        // Deferred rendering was requested for this instance. The file it renders
        // has the final say, since a file's mode is fixed at import.
        this.deferredRenderer = false;
        // Decides the context attributes on every init(); cleared if the renderer can't inkbleed.
        this._inkbleedCapable = false;
        this._inkbleed = false;
        // Whether this instance imported the file in `riveFile` (true) or the caller
        // supplied it (false). Only a file we imported may be released without a
        // matching getInstance(): a caller's file is theirs however this init ends.
        this.ownsRiveFile = false;
        // Runtime artboard
        this.artboard = null;
        // place to clear up pointer/touch event listeners
        this.eventCleanup = null;
        // Manages keyboard and DOM-focus interactions for the canvas.
        this._keyboardInteractions = null;
        this.shouldDisableRiveListeners = false;
        this.automaticallyHandleEvents = false;
        this.dispatchPointerExit = true;
        // Allow all pointers to be passed to the runtime
        this.enableMultiTouch = false;
        // Allow the runtime to automatically load assets hosted in Rive's runtime.
        this.enableRiveAssetCDN = true;
        this.semanticsMode = _semantics__WEBPACK_IMPORTED_MODULE_2__.SemanticMode.Disabled;
        this.semanticsOptions = {
            riveCanvasLabel: "Rive animation",
        };
        /** True when this instance may drain semantics and render the overlay. */
        this._semanticsActive = false;
        // Keep a local value of the set volume to update it asynchronously
        this._volume = 1;
        // Keep a local value of the set width to update it asynchronously
        this._artboardWidth = undefined;
        // Keep a local value of the set height to update it asynchronously
        this._artboardHeight = undefined;
        // Keep a local value of the device pixel ratio used in rendering and canvas/artboard resizing
        this._devicePixelRatioUsed = 1;
        // Whether the canvas element's size is 0
        this._hasZeroSize = false;
        // Whether a draw operation needs to be forced
        this._needsRedraw = false;
        // Canvas width and height. Values are lazily updated so they might
        // not be in sync with current canvas size.
        this._currentCanvasWidth = 0;
        this._currentCanvasHeight = 0;
        // Audio event listener
        this._audioEventListener = null;
        // draw method bound to the class
        this._boundDraw = null;
        // Page visibility handler — prevents state machine advancing / rAF from being invoked with large time delta
        // when the browser tab is switched back to after being hidden.
        this._pageVisibilityHandler = null;
        // True only when the page visibility handler itself cancelled an active frame.
        // Set by stopRendering(), cleared by startRendering(). Prevents the
        // visibilitychange handler from restarting a rendering loop the caller intentionally stopped.
        this._explicitlyStoppedRendering = false;
        this._viewModelInstance = null;
        // User-provided global view model instances, keyed by their global view
        // model's name. Globals not present here are still driven by the default
        // instances the runtime seeds; the getter only surfaces instances the user
        // has explicitly set.
        this._globalViewModelInstances = new Map();
        this._dataEnums = null;
        this._tabIndex = null;
        this._prevHasFocus = false;
        this._prevWantsTextInputSession = false;
        // Pointer-down defers the proxy focus: mousedown's default would refocus the canvas and
        // touchstart isn't user activation; pointer-up focuses it.
        this._inPointerDownDrain = false;
        this._focusOptions = {
            allowFocusInterrupt: false,
        };
        // Tracks the semantic tree for the given graphic
        this._semanticTree = null;
        this._accessibilityOverlay = null;
        /**
         * True when an input to the accessibility overlay's artboard→canvas transform
         * (layout fit/alignment/bounds, devicePixelRatio, or layout scale) has changed
         * and the matrix must be recomputed on the next overlay update. Avoids calling
         * computeAlignment every frame when only the semantic tree changed.
         */
        this._overlayTransformDirty = true;
        // Module-level counter for unique instance IDs for semantic overlay containers
        this._instanceId = "".concat(nextRiveInstanceId++);
        this.drawOptimization = DrawOptimizationOptions.DrawOnChanged;
        // When true, emits performance.mark/measure entries for load and render.
        this.enablePerfMarks = false;
        // Durations to generate a frame for the last second. Used for performance profiling.
        this.durations = [];
        this.frameTimes = [];
        this.frameCount = 0;
        this.isTouchScrollEnabled = false;
        this.onCanvasResize = function (hasZeroSize) {
            var toggledDisplay = _this._hasZeroSize !== hasZeroSize;
            _this._hasZeroSize = hasZeroSize;
            if (!hasZeroSize) {
                if (toggledDisplay) {
                    _this.resizeDrawingSurfaceToCanvas();
                }
            }
            else if (!_this._layout.maxX || !_this._layout.maxY) {
                _this.resizeToCanvas();
            }
        };
        this.isEditingHostFocused = function () { var _a, _b; return (_b = (_a = _this._keyboardInteractions) === null || _a === void 0 ? void 0 : _a.isEditingHostFocused()) !== null && _b !== void 0 ? _b : false; };
        // Tracks the current animation frame request
        this.frameRequestId = null;
        /**
         * Used be draw to track when a second of active rendering time has passed.
         * Used for debugging purposes
         */
        this.renderSecondTimer = 0;
        this._boundDraw = this.draw.bind(this);
        if (typeof document !== 'undefined') {
            this._pageVisibilityHandler = this._onPageVisibilityChange.bind(this);
            document.addEventListener('visibilitychange', this._pageVisibilityHandler);
        }
        this.canvas = params.canvas;
        if (params.canvas.constructor === HTMLCanvasElement) {
            this._observed = observers.add(this.canvas, this.onCanvasResize);
        }
        this._currentCanvasWidth = this.canvas.width;
        this._currentCanvasHeight = this.canvas.height;
        this.src = params.src;
        this.buffer = params.buffer;
        this.riveFile = params.riveFile;
        this.layout = (_a = params.layout) !== null && _a !== void 0 ? _a : new Layout();
        this.shouldDisableRiveListeners = !!params.shouldDisableRiveListeners;
        this.isTouchScrollEnabled = !!params.isTouchScrollEnabled;
        if (params.automaticallyHandleEvents) {
            warnOnce(DeprecationKeys.riveEvents, "The `automaticallyHandleEvents` parameter is deprecated. " +
                riveEventsDeprecationWarning);
        }
        this.automaticallyHandleEvents = !!params.automaticallyHandleEvents;
        this.dispatchPointerExit =
            params.dispatchPointerExit === false
                ? params.dispatchPointerExit
                : this.dispatchPointerExit;
        this.enableMultiTouch = !!params.enableMultiTouch;
        this.drawOptimization = (_b = params.drawingOptions) !== null && _b !== void 0 ? _b : this.drawOptimization;
        this.enableRiveAssetCDN =
            params.enableRiveAssetCDN === undefined
                ? true
                : params.enableRiveAssetCDN;
        this.enablePerfMarks = !!params.enablePerfMarks;
        if (this.enablePerfMarks)
            _runtimeLoader__WEBPACK_IMPORTED_MODULE_1__.RuntimeLoader.enablePerfMarks = true;
        this._focusOptions = (_c = params.focusOptions) !== null && _c !== void 0 ? _c : this._focusOptions;
        this._tabIndex = (_d = params.tabIndex) !== null && _d !== void 0 ? _d : null;
        this.deferredRenderer = !!params.enableGPUCanvas;
        this._inkbleedCapable = !!params.enableInkbleed;
        this._inkbleed = this._inkbleedCapable;
        // New event management system
        this.eventManager = new EventManager();
        if (params.onLoad)
            this.on(EventType.Load, params.onLoad);
        if (params.onLoadError)
            this.on(EventType.LoadError, params.onLoadError);
        if (params.onPlay)
            this.on(EventType.Play, params.onPlay);
        if (params.onPause)
            this.on(EventType.Pause, params.onPause);
        if (params.onStop)
            this.on(EventType.Stop, params.onStop);
        if (params.onLoop)
            this.on(EventType.Loop, params.onLoop);
        if (params.onStateChange)
            this.on(EventType.StateChange, params.onStateChange);
        if (params.onAdvance)
            this.on(EventType.Advance, params.onAdvance);
        /**
         * @deprecated Use camelCase'd versions instead.
         */
        if (params.onload && !params.onLoad)
            this.on(EventType.Load, params.onload);
        if (params.onloaderror && !params.onLoadError)
            this.on(EventType.LoadError, params.onloaderror);
        if (params.onplay && !params.onPlay)
            this.on(EventType.Play, params.onplay);
        if (params.onpause && !params.onPause)
            this.on(EventType.Pause, params.onpause);
        if (params.onstop && !params.onStop)
            this.on(EventType.Stop, params.onstop);
        if (params.onloop && !params.onLoop)
            this.on(EventType.Loop, params.onloop);
        if (params.onstatechange && !params.onStateChange)
            this.on(EventType.StateChange, params.onstatechange);
        /**
         * Asset loading
         */
        if (params.assetLoader)
            this.assetLoader = params.assetLoader;
        // Hook up the task queue
        this.taskQueue = new TaskQueueManager(this.eventManager);
        this.init({
            src: this.src,
            buffer: this.buffer,
            riveFile: this.riveFile,
            autoplay: params.autoplay,
            autoBind: params.autoBind,
            stateMachine: params.stateMachine,
            animations: params.animations,
            stateMachines: params.stateMachines,
            artboard: params.artboard,
            useOffscreenRenderer: params.useOffscreenRenderer,
            tabIndex: params.tabIndex,
            semanticsMode: params.semanticsMode,
            semanticsOptions: params.semanticsOptions,
            enableGPUCanvas: this.deferredRenderer,
        });
    }
    Object.defineProperty(Rive, "suppressDeprecationWarnings", {
        /**
         * Deprecation warnings to silence, by {@link DeprecationId}. Each warning
         * prints the id needed to silence it, so you can copy it out of the console.
         *
         * ```ts
         * Rive.suppressDeprecationWarnings = ["rive-events", "text-runs"];
         * ```
         *
         * Assigning replaces the whole list.
         * There is no option to silence everything
         */
        get: function () {
            return Object.freeze(Array.from(suppressedDeprecations));
        },
        set: function (ids) {
            setSuppressedDeprecations(ids);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "viewModelCount", {
        get: function () {
            return this.file.viewModelCount();
        },
        enumerable: false,
        configurable: true
    });
    // Alternative constructor to build a Rive instance from an interface/object
    Rive.new = function (params) {
        warnOnce(DeprecationKeys.legacyConstructors, "This function is deprecated: please use `new Rive({})` instead");
        return new Rive(params);
    };
    /**
     * @experimental Turns on semantics and the accessibility overlay for this
     * instance. Idempotent; safe to call before or after load. Use this to drive
     * a consumer-controlled accessibility toggle when constructed with the
     * default {@link SemanticMode.Disabled}.
     */
    Rive.prototype.enableSemantics = function () {
        this.semanticsMode = _semantics__WEBPACK_IMPORTED_MODULE_2__.SemanticMode.Enabled;
        this.activateSemantics();
    };
    Rive.prototype.activateSemantics = function () {
        if (this._semanticsActive || this.semanticsMode === _semantics__WEBPACK_IMPORTED_MODULE_2__.SemanticMode.Disabled) {
            return;
        }
        this._semanticsActive = true;
        this.syncSemanticsOnStateMachines();
    };
    Rive.prototype.syncSemanticsOnStateMachines = function () {
        if (!this._semanticsActive || !this.animator) {
            return;
        }
        for (var _i = 0, _a = this.animator.stateMachines; _i < _a.length; _i++) {
            var stateMachine = _a[_i];
            stateMachine.enableSemantics();
        }
    };
    /**
     * Tears down the semantic tree and accessibility overlay. The overlay captures the
     * active state machine in its action closures, so it must not outlive the
     * instances it points at (reset/load delete them)
     */
    Rive.prototype.cleanupSemantics = function () {
        this._semanticTree = null;
        if (this._accessibilityOverlay) {
            this._accessibilityOverlay.destroy();
            this._accessibilityOverlay = null;
        }
    };
    // Event handler for when audio context becomes available
    Rive.prototype.onSystemAudioChanged = function () {
        this.volume = this._volume;
    };
    // Initializes the Rive object either from constructor or load()
    Rive.prototype.init = function (_a) {
        var _this = this;
        var _b, _c, _d, _e, _f;
        var src = _a.src, buffer = _a.buffer, riveFile = _a.riveFile, stateMachine = _a.stateMachine, animations = _a.animations, stateMachines = _a.stateMachines, artboard = _a.artboard, _g = _a.autoplay, autoplay = _g === void 0 ? false : _g, _h = _a.useOffscreenRenderer, useOffscreenRenderer = _h === void 0 ? false : _h, _j = _a.autoBind, autoBind = _j === void 0 ? false : _j, tabIndex = _a.tabIndex, semanticsMode = _a.semanticsMode, semanticsOptions = _a.semanticsOptions, enableGPUCanvas = _a.enableGPUCanvas;
        if (this.destroyed) {
            return;
        }
        // Validated before any state changes, so a call with no source leaves a
        // running instance untouched.
        if (!src && !buffer && !riveFile) {
            throw new RiveError(Rive.missingErrorMessage);
        }
        // Reload releases the outgoing file in the same order cleanup() uses:
        // artboard, then the renderer's session, then the file. The artboard goes
        // first because it holds an rcp<File> and its resources came from the
        // session about to be released. stop() has already deleted the animation
        // and state machine instances; reload deliberately skips cleanupInstances(),
        // which would also drop the event listeners load() keeps in place.
        if (this.artboard) {
            // Free GPU-backed resources with their own context current. No-op on
            // the canvas2d build.
            (_c = (_b = this.renderer) === null || _b === void 0 ? void 0 : _b.bindContext) === null || _c === void 0 ? void 0 : _c.call(_b);
            (_d = this.animator) === null || _d === void 0 ? void 0 : _d.stop();
            this.artboard.delete();
            this.artboard = null;
        }
        // Detach before the session is deleted: the handle dies with it.
        if (this.renderer) {
            (_f = (_e = this.renderer).detachSession) === null || _f === void 0 ? void 0 : _f.call(_e);
        }
        this.releaseCurrentRiveFile(/* isTeardown */ false);
        this.src = src;
        this.buffer = buffer;
        this.riveFile = riveFile;
        // initData flips this if it ends up importing the file itself.
        this.ownsRiveFile = false;
        // Sticky across reloads so a constructor-set flag survives; an explicit
        // `false` still turns it off.
        this.deferredRenderer = enableGPUCanvas !== null && enableGPUCanvas !== void 0 ? enableGPUCanvas : this.deferredRenderer;
        this._tabIndex = tabIndex !== null && tabIndex !== void 0 ? tabIndex : null;
        this.semanticsMode = semanticsMode !== null && semanticsMode !== void 0 ? semanticsMode : _semantics__WEBPACK_IMPORTED_MODULE_2__.SemanticMode.Disabled;
        this.semanticsOptions = semanticsOptions !== null && semanticsOptions !== void 0 ? semanticsOptions : this.semanticsOptions;
        // Names of the animations and state machines that should be initialized
        var _k = resolveStartingPlayback({
            stateMachine: stateMachine,
            animations: animations,
            stateMachines: stateMachines,
        }), startingAnimationNames = _k.startingAnimationNames, startingStateMachineNames = _k.startingStateMachineNames;
        // Ensure loaded is marked as false if loading new file
        this.loaded = false;
        this.readyForPlaying = false;
        // Ensure the runtime is loaded
        _runtimeLoader__WEBPACK_IMPORTED_MODULE_1__.RuntimeLoader.awaitInstance()
            .then(function (runtime) {
            if (_this.destroyed) {
                return;
            }
            _this.runtime = runtime;
            _this.removeRiveListeners();
            // load() reinitializes without cleanupInstances(); drop any stale overlay
            // bound to the previous file's state machines (no-op on first construct).
            _this.cleanupSemantics();
            _this.deleteRiveRenderer();
            // Get the canvas where you want to render the animation and create a renderer
            if (_this.enablePerfMarks)
                performance.mark('rive:make-renderer:start');
            try {
                // Always immediate at creation; a deferred file attaches its session
                // to this renderer once the file has loaded.
                _this.renderer = _this.runtime.makeRenderer(_this.canvas, useOffscreenRenderer, { inkbleed: _this._inkbleedCapable });
                if (!_this.renderer) {
                    throw new Error("Renderer is null, cannot render Rive on the canvas.");
                }
            }
            catch (e) {
                console.error(e);
                throw new RiveError("Unable to create the renderer, your environment may not support WebGL. Try the @rive-app/canvas runtime as an alternative.");
            }
            if (_this._inkbleedCapable) {
                _this.applyInkbleed();
            }
            if (_this.enablePerfMarks) {
                performance.mark('rive:make-renderer:end');
                performance.measure('rive:make-renderer', 'rive:make-renderer:start', 'rive:make-renderer:end');
            }
            // Initial size adjustment based on devicePixelRatio if no width/height are
            // specified explicitly
            if (!(_this.canvas.width || _this.canvas.height)) {
                _this.resizeDrawingSurfaceToCanvas();
            }
            // Load Rive data from a source uri or a data buffer
            _this.initData(artboard, startingAnimationNames, startingStateMachineNames, autoplay, autoBind)
                .then(function (hasInitialized) {
                if (hasInitialized) {
                    return _this.setupRiveListeners();
                }
            })
                .catch(function (e) {
                // initData already catches RiveErrors for load issues like artboard/state machine initialization
                // failures, so just console error and catch here so we don't double-fire the LoadError event
                console.error(e);
            });
        })
            .catch(function (e) {
            _this.eventManager.fire({ type: EventType.LoadError, data: e.message });
        });
    };
    /**
     * Setup Rive Listeners on the canvas
     * @param riveListenerOptions - Enables TouchEvent events on the canvas. Set to true to allow
     * touch scrolling on the canvas element on touch-enabled devices
     * i.e. { isTouchScrollEnabled: true }
     */
    Rive.prototype.setupRiveListeners = function (riveListenerOptions) {
        var _this = this;
        if (this.eventCleanup) {
            this.eventCleanup();
        }
        this.cleanupKeyboardInteractions();
        if (!this.shouldDisableRiveListeners) {
            var playingStateMachines = this.animator.stateMachines.filter(function (sm) { return sm.playing; });
            var activeStateMachines = playingStateMachines
                .filter(function (sm) { return _this.runtime.hasListeners(sm.instance); })
                .map(function (sm) { return sm.instance; });
            var touchScrollEnabledOption = this.isTouchScrollEnabled;
            var dispatchPointerExit = this.dispatchPointerExit;
            var enableMultiTouch = this.enableMultiTouch;
            if (riveListenerOptions &&
                "isTouchScrollEnabled" in riveListenerOptions) {
                touchScrollEnabledOption = riveListenerOptions.isTouchScrollEnabled;
            }
            this.eventCleanup = (0,_utils__WEBPACK_IMPORTED_MODULE_3__.registerTouchInteractions)({
                canvas: this.canvas,
                artboard: this.artboard,
                stateMachines: activeStateMachines,
                renderer: this.renderer,
                rive: this.runtime,
                fit: this._layout.runtimeFit(this.runtime),
                alignment: this._layout.runtimeAlignment(this.runtime),
                isTouchScrollEnabled: touchScrollEnabledOption,
                dispatchPointerExit: dispatchPointerExit,
                enableMultiTouch: enableMultiTouch,
                layoutScaleFactor: this._layout.layoutScaleFactor,
                advanceAndDrain: this.advanceAndDrainForPointer.bind(this),
                summonKeyboard: this.summonKeyboardForGesture.bind(this),
                isTextProxyFocused: this.isEditingHostFocused,
            });
            this.ensureKeyboardInteractions();
        }
    };
    Object.defineProperty(Rive.prototype, "focusStateMachine", {
        // Assumes a single state machine drives focus.
        get: function () {
            return this.animator.stateMachines.find(function (sm) { return sm.playing && sm.hasFocusNodes; });
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Wire keyboard interactions when a playing state machine has focus nodes.
     * Called at listener setup and lazily each frame so late-bound bindable artboards work.
     */
    Rive.prototype.ensureKeyboardInteractions = function () {
        var _this = this;
        if (this._keyboardInteractions ||
            this.shouldDisableRiveListeners ||
            typeof window === "undefined" ||
            !(this.canvas instanceof HTMLCanvasElement)) {
            return;
        }
        var smWithFocusNodes = this.focusStateMachine;
        if (!smWithFocusNodes) {
            return;
        }
        var currentCanvasTabIndex = this.canvas.tabIndex;
        if (currentCanvasTabIndex === -1 || isNaN(currentCanvasTabIndex)) {
            this.canvas.tabIndex = (this._tabIndex !== null ? this._tabIndex : 0);
        }
        this._keyboardInteractions = new _utils__WEBPACK_IMPORTED_MODULE_3__.KeyboardInteractions({
            canvas: this.canvas,
            stateMachine: smWithFocusNodes.instance,
            hasFocusNodes: true,
            getOverlayElement: function () { var _a, _b; return (_b = (_a = _this._accessibilityOverlay) === null || _a === void 0 ? void 0 : _a.getSemanticOverlayContainer()) !== null && _b !== void 0 ? _b : null; },
        });
    };
    /** Runs inside touchend/mouseup so focusing the proxy raises the mobile keyboard. */
    Rive.prototype.summonKeyboardForGesture = function () {
        if (!this._keyboardInteractions)
            return;
        var activeSm = this.focusStateMachine;
        if (!activeSm)
            return;
        if (this.wantsTextInputSession(activeSm.focusState().expectsKeyboardInput)) {
            this._keyboardInteractions.summonForPointer();
        }
    };
    /** expectsKeyboardInput, and (with semantics on) the focused node is a textField. */
    Rive.prototype.wantsTextInputSession = function (expectsKeyboardInput) {
        var _a;
        if (!expectsKeyboardInput)
            return false;
        var node = (_a = this._semanticTree) === null || _a === void 0 ? void 0 : _a.focusedNode();
        return node === undefined || node.role === _semantics__WEBPACK_IMPORTED_MODULE_2__.SemanticRole.textField;
    };
    Rive.prototype.advanceAndDrainForPointer = function (elapsedTime, options) {
        if (!(options === null || options === void 0 ? void 0 : options.pointerDown)) {
            this.advanceAndReportChanges(elapsedTime);
            return;
        }
        this._inPointerDownDrain = true;
        try {
            this.advanceAndReportChanges(elapsedTime);
        }
        finally {
            this._inPointerDownDrain = false;
        }
    };
    Rive.prototype.cleanupKeyboardInteractions = function () {
        var _a;
        if (this._keyboardInteractions) {
            this._keyboardInteractions.cleanup();
            this._keyboardInteractions = null;
        }
        this._prevWantsTextInputSession = false;
        (_a = this._accessibilityOverlay) === null || _a === void 0 ? void 0 : _a.releaseEditingHost(null, null);
    };
    /**
     * Remove Rive Listeners setup on the canvas
     */
    Rive.prototype.removeRiveListeners = function () {
        if (this.eventCleanup) {
            this.eventCleanup();
            this.eventCleanup = null;
        }
        this.cleanupKeyboardInteractions();
    };
    /**
     * If the instance has audio and the system audio is not ready
     * we hook the instance to the audio manager
     */
    Rive.prototype.initializeAudio = function () {
        var _this = this;
        var _a;
        // Initialize audio if needed
        if (audioManager.status == SystemAudioStatus.UNAVAILABLE) {
            if (this.file.hasAudio ||
                (((_a = this.artboard) === null || _a === void 0 ? void 0 : _a.hasAudio) && this._audioEventListener === null)) {
                this._audioEventListener = {
                    type: EventType.AudioStatusChange,
                    callback: function () { return _this.onSystemAudioChanged(); },
                };
                audioManager.add(this._audioEventListener);
                audioManager.establishAudio();
            }
        }
    };
    Rive.prototype.initArtboardSize = function () {
        if (!this.artboard)
            return;
        // Use preset values if they are not undefined
        this._artboardWidth = this.artboard.width =
            this._artboardWidth || this.artboard.width;
        this._artboardHeight = this.artboard.height =
            this._artboardHeight || this.artboard.height;
    };
    // Initializes runtime with Rive data and preps for playing.
    // Returns true for successful initialization.
    Rive.prototype.initData = function (artboardName, animationNames, stateMachineNames, autoplay, autoBind) {
        return __awaiter(this, void 0, void 0, function () {
            var riveFile, error_4, msg;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 5, , 6]);
                        // A caller-supplied riveFile is theirs to release; one we import here is
                        // ours, which matters if a deferred fallback replaces it below.
                        this.ownsRiveFile = this.riveFile == null;
                        if (!this.ownsRiveFile) return [3 /*break*/, 2];
                        riveFile = new RiveFile({
                            src: this.src,
                            buffer: this.buffer,
                            enableRiveAssetCDN: this.enableRiveAssetCDN,
                            assetLoader: this.assetLoader,
                            enablePerfMarks: this.enablePerfMarks,
                            // The instance owns this file, so its flag is the file's flag.
                            enableGPUCanvas: this.deferredRenderer,
                        });
                        this.riveFile = riveFile;
                        return [4 /*yield*/, riveFile.init()];
                    case 1:
                        _c.sent();
                        if (this.destroyed) {
                            // In the very unlikely scenario where the rive file created by this Rive is shared by
                            // another rive file, we only want to destroy it if this file is the only owner.
                            riveFile.destroyIfUnused();
                            return [2 /*return*/, false];
                        }
                        _c.label = 2;
                    case 2:
                        if (!(this.riveFile.deferredSession !== null || this.deferredRenderer)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.resolveDeferredRendering()];
                    case 3:
                        _c.sent();
                        if (this.destroyed) {
                            // cleanup() ran during a re-import. Taking a reference now would
                            // resurrect a file this instance is never going to draw. Only ours
                            // to release — a caller-supplied file stays theirs.
                            if (this.ownsRiveFile) {
                                (_a = this.riveFile) === null || _a === void 0 ? void 0 : _a.destroyIfUnused();
                            }
                            return [2 /*return*/, false];
                        }
                        _c.label = 4;
                    case 4:
                        this.file = this.riveFile.getInstance();
                        this.reportDisplayScale();
                        // Initialize and draw frame
                        this.initArtboard(artboardName, animationNames, stateMachineNames, autoplay, autoBind);
                        // Initialize the artboard size
                        this.initArtboardSize();
                        // Check for audio
                        this.initializeAudio();
                        if (this.semanticsMode === _semantics__WEBPACK_IMPORTED_MODULE_2__.SemanticMode.Enabled) {
                            this.activateSemantics();
                        }
                        else if (this._semanticsActive) {
                            this.syncSemanticsOnStateMachines();
                        }
                        // Everything's set up, emit a load event
                        try {
                            this.loaded = true;
                            this.eventManager.fire({
                                type: EventType.Load,
                                data: (_b = this.src) !== null && _b !== void 0 ? _b : "buffer",
                            });
                        }
                        catch (e) {
                            // If any synchronous errors surface from the user-supplied onLoad callback,
                            // this will console.error the error but will not invoke LoadError (onLoadError).
                            // Notably, this will not interfere with Rive rendering
                            console.error(e);
                        }
                        // Only initialize paused state machines after the load event has been fired
                        // to allow users to initialize inputs and view models before the first advance
                        this.animator.advanceIfPaused();
                        // Flag ready for playback commands and clear the task queue; this order
                        // is important or it may infinitely recurse
                        this.readyForPlaying = true;
                        this.taskQueue.process();
                        this.drawFrame();
                        return [2 /*return*/, true];
                    case 5:
                        error_4 = _c.sent();
                        msg = resolveErrorMessage(error_4);
                        this.eventManager.fire({ type: EventType.LoadError, data: msg });
                        return [2 /*return*/, Promise.reject(msg)];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Settles which rendering mode this Rive instance runs in. The file dictates: its rendering mode
     * is fixed at import, and an immediate renderer silently drops a deferred
     * file's resources. Every mismatch warns and degrades to something that
     * renders, so users shouldn't have a blank canvas. A fallback self-reimport replaces `this.riveFile`;
     * only a file this instance imported is released when that happens.
     */
    Rive.prototype.resolveDeferredRendering = function () {
        return __awaiter(this, void 0, void 0, function () {
            var file, ownsFile, renderer, session, attachSession, immediate, copy, copySession, fallback;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        file = this.riveFile;
                        ownsFile = this.ownsRiveFile;
                        renderer = this.renderer;
                        session = file.deferredSession;
                        if (session === null) {
                            // No second warning when the file asked for deferred and the build
                            // could not honor it; the unsupported-build warning already fired, and
                            // telling the user to set a flag they set would mislead.
                            if (this.deferredRenderer && !file.deferredRequested) {
                                console.warn("Rive: `enableGPUCanvas: true` was ignored because this RiveFile was imported without it. The mode is fixed at import: construct the RiveFile with `enableGPUCanvas: true` to opt in.");
                            }
                            return [2 /*return*/];
                        }
                        if (!this.deferredRenderer) {
                            console.warn("Rive: this RiveFile was imported with `enableGPUCanvas: true`, so this instance renders deferred even though `enableGPUCanvas` is false on the instance. An immediate renderer would drop the file's deferred resources and draw nothing.");
                        }
                        attachSession = renderer === null || renderer === void 0 ? void 0 : renderer.attachSession;
                        if (!(typeof attachSession !== "function")) return [3 /*break*/, 2];
                        // Offscreen renderers share one context across canvases, which a session
                        // cannot record for. An immediate copy of the file still renders.
                        console.warn("Rive: this renderer cannot replay a deferred session (`useOffscreenRenderer` is not supported with deferred rendering). Re-importing the file in immediate mode for this instance.");
                        return [4 /*yield*/, file.reimport(false)];
                    case 1:
                        immediate = _b.sent();
                        if (this.destroyed) {
                            // cleanup() ran while we were importing; nothing will use this copy.
                            immediate.destroyIfUnused();
                            return [2 /*return*/];
                        }
                        this.riveFile = immediate;
                        this.ownsRiveFile = true;
                        if (ownsFile) {
                            // Nothing else can reach the deferred import we just walked away from.
                            file.destroyIfUnused();
                        }
                        return [2 /*return*/];
                    case 2:
                        // Never re-offered once claimed, even if that renderer is gone: the
                        // resources the session's stream refers to died with it.
                        if (!file.sessionClaimed && attachSession.call(renderer, session)) {
                            file.claimSession();
                            return [2 /*return*/];
                        }
                        // Bound to another instance. Re-import from the retained buffer into a
                        // session of our own.
                        file.warnBoundElsewhereOnce();
                        return [4 /*yield*/, file.reimport(true)];
                    case 3:
                        copy = _b.sent();
                        if (this.destroyed) {
                            // The renderer was deleted while we imported; attaching to it would hand
                            // embind a deleted object.
                            copy.destroyIfUnused();
                            return [2 /*return*/];
                        }
                        this.riveFile = copy;
                        this.ownsRiveFile = true;
                        copySession = copy.deferredSession;
                        if (copySession !== null && attachSession.call(renderer, copySession)) {
                            copy.claimSession();
                            return [2 /*return*/];
                        }
                        // The copy's session could not take this canvas either (this renderer
                        // already holds one). An immediate re-import still renders; a deferred file
                        // on an immediate renderer would drop its resources and draw nothing.
                        console.warn("Rive: could not attach the re-imported file's deferred session to this canvas; falling back to immediate rendering for this instance.");
                        // If a leftover session is why the attach failed, it would keep routing
                        // the immediate file's draws into its recorder, which drops them.
                        (_a = renderer.detachSession) === null || _a === void 0 ? void 0 : _a.call(renderer);
                        return [4 /*yield*/, file.reimport(false)];
                    case 4:
                        fallback = _b.sent();
                        // The deferred copy was only ever ours, so it always goes.
                        copy.destroyIfUnused();
                        if (this.destroyed) {
                            fallback.destroyIfUnused();
                            return [2 /*return*/];
                        }
                        this.riveFile = fallback;
                        this.ownsRiveFile = true;
                        if (ownsFile) {
                            file.destroyIfUnused();
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    // Initialize for playback
    Rive.prototype.initArtboard = function (artboardName, animationNames, stateMachineNames, autoplay, autoBind) {
        if (!this.file) {
            return;
        }
        // Fetch the artboard
        var rootArtboard = artboardName
            ? this.file.artboardByName(artboardName)
            : this.file.defaultArtboard();
        // Check we have a working artboard
        if (!rootArtboard) {
            throw new RiveError("Invalid artboard name or no default artboard");
        }
        this.artboard = rootArtboard;
        rootArtboard.volume = this._volume * audioManager.systemVolume;
        // Initialize the animator
        this.animator = new Animator(this.runtime, this.artboard, this.eventManager);
        // Initialize the animations; as loaded hasn't happened yet, we need to
        // suppress firing the play/pause events until the load event has fired. To
        // do this we tell the animator to suppress firing events, and add event
        // firing to the task queue.
        var instanceNames;
        if (animationNames.length > 0 || stateMachineNames.length > 0) {
            instanceNames = animationNames.concat(stateMachineNames);
            this.animator.initLinearAnimations(animationNames, autoplay);
            this.animator.initStateMachines(stateMachineNames, autoplay, this._semanticsActive);
        }
        else {
            instanceNames = [this.animator.atLeastOne(autoplay, false, this._semanticsActive)];
        }
        // Queue up firing the playback events
        this.taskQueue.add({
            event: {
                type: autoplay ? EventType.Play : EventType.Pause,
                data: instanceNames,
            },
        });
        if (autoBind) {
            // Set the main view model instance (if the artboard has one)...
            var viewModel = this.file.defaultArtboardViewModel(rootArtboard);
            if (viewModel !== null) {
                var runtimeInstance = viewModel.defaultInstance();
                if (runtimeInstance !== null) {
                    var viewModelInstance = new ViewModelInstance(runtimeInstance, null);
                    (0,_utils__WEBPACK_IMPORTED_MODULE_3__.createFinalization)(viewModelInstance, viewModelInstance.runtimeInstance);
                    this.setViewModelInstance(viewModelInstance);
                }
            }
            // ...and a default instance for each global view model (no longer
            // auto-created by the runtime), then apply everything in one rebind.
            for (var _i = 0, _a = this.file.globalViewModelNames(); _i < _a.length; _i++) {
                var name_1 = _a[_i];
                var globalViewModel = this.file.viewModelByName(name_1);
                if (globalViewModel !== null) {
                    var instance = new ViewModel(globalViewModel).defaultInstance();
                    if (instance !== null) {
                        this.setGlobalViewModelInstance(name_1, instance);
                    }
                }
            }
            this.bind();
        }
    };
    // Draws the current artboard frame
    Rive.prototype.drawFrame = function () {
        var _a, _b;
        if ((_a = document === null || document === void 0 ? void 0 : document.timeline) === null || _a === void 0 ? void 0 : _a.currentTime) {
            if (this.loaded && this.artboard && !this.frameRequestId) {
                this._boundDraw(document.timeline.currentTime);
                (_b = this.runtime) === null || _b === void 0 ? void 0 : _b.resolveAnimationFrame();
            }
        }
        else {
            this.scheduleRendering();
        }
    };
    Rive.prototype._canvasSizeChanged = function () {
        var changed = false;
        if (this.canvas) {
            if (this.canvas.width !== this._currentCanvasWidth) {
                this._currentCanvasWidth = this.canvas.width;
                changed = true;
            }
            if (this.canvas.height !== this._currentCanvasHeight) {
                this._currentCanvasHeight = this.canvas.height;
                changed = true;
            }
        }
        return changed;
    };
    // Content the artboard's change flag cannot see: ore and GPU canvas commands
    // scripts record straight into the session. Must be read before the renderer
    // clears — clearing marks the stream, so a later read is true every frame.
    Rive.prototype._deferredWorkPending = function () {
        var _a, _b, _c;
        return (_c = (_b = (_a = this.riveFile) === null || _a === void 0 ? void 0 : _a.deferredSession) === null || _b === void 0 ? void 0 : _b.recordedThisFrame()) !== null && _c !== void 0 ? _c : false;
    };
    /** Rive can move focus on its own, so reconcile the text session and DOM focus each frame. */
    Rive.prototype.pollFocusState = function () {
        this.ensureKeyboardInteractions();
        var ki = this._keyboardInteractions;
        var activeSm = ki ? this.focusStateMachine : undefined;
        if (!ki || !activeSm || !(this.canvas instanceof HTMLCanvasElement)) {
            this._prevHasFocus = false;
            this._prevWantsTextInputSession = false;
            return;
        }
        var _a = activeSm.focusState(), hasFocus = _a.hasFocus, expectsKeyboardInput = _a.expectsKeyboardInput;
        this.syncTextInputSession(ki, this.wantsTextInputSession(expectsKeyboardInput));
        this.syncRiveFocus(ki, this.canvas, hasFocus);
    };
    /** Begin/end the text session on wantsSession edges; decorate the proxy while it has DOM focus. */
    Rive.prototype.syncTextInputSession = function (ki, wantsSession) {
        var host = ki.editingHost;
        var overlay = this._accessibilityOverlay;
        if (wantsSession) {
            var began = !this._prevWantsTextInputSession;
            if (began) {
                // In-domain or opted-in only; during pointer-down, pointer-up focuses instead.
                var focusProxy = !this._inPointerDownDrain &&
                    (ki.isInFocusDomain(document.activeElement) ||
                        !!this._focusOptions.allowFocusInterrupt);
                ki.beginTextInputSession(focusProxy);
            }
            // The <input> proxy stands in for the semantic DOM field only while it holds DOM focus.
            if (overlay && this._semanticTree) {
                if (host.hasDomFocus()) {
                    overlay.syncEditingHost(this._semanticTree, host, began || !overlay.hasEditingHost());
                }
                else if (overlay.hasEditingHost()) {
                    overlay.releaseEditingHost(this._semanticTree, host);
                }
            }
        }
        else if (this._prevWantsTextInputSession) {
            // Overlay hand-off first, ahead of endTextInputSession's park-on-canvas fallback.
            overlay === null || overlay === void 0 ? void 0 : overlay.releaseEditingHost(this._semanticTree, host);
            ki.endTextInputSession();
        }
        this._prevWantsTextInputSession = wantsSession;
    };
    /** Mirror Rive's hasFocus into the keyboard session state and, on opt-in, canvas focus. */
    Rive.prototype.syncRiveFocus = function (ki, canvas, hasFocus) {
        if (hasFocus) {
            ki.notifyRiveFocused();
            // Pull focus from outside Rive only with allowFocusInterrupt.
            if (!this._prevHasFocus) {
                if (!ki.isInFocusDomain(document.activeElement) &&
                    this._focusOptions.allowFocusInterrupt) {
                    canvas.focus();
                }
                this._prevHasFocus = true;
            }
        }
        else {
            this._prevHasFocus = false;
            // Rive released focus internally (e.g. a state change): drop the Tab trap so the next
            // Tab leaves the canvas.
            if (ki.focusSessionState === _utils__WEBPACK_IMPORTED_MODULE_3__.FocusSessionState.RiveFocused) {
                ki.setFocusSessionState(_utils__WEBPACK_IMPORTED_MODULE_3__.FocusSessionState.NotFocused);
            }
        }
    };
    /**
     * Handles important sequence of reporting Rive events, advancing the state machine or animation, and invoking various callbacks
     * due to state changes, view model property changes, etc.
     *
     * @param elapsedTime time to advance the state machine by
     */
    Rive.prototype.advanceAndReportChanges = function (elapsedTime) {
        var _a, _b;
        // - Advance non-paused animations by the elapsed number of seconds
        // - Advance any animations that require scrubbing
        // - Advance to the first frame even when autoplay is false
        var activeAnimations = this.animator.animations
            .filter(function (a) { return a.playing || a.needsScrub; })
            // The scrubbed animations must be applied first to prevent weird artifacts
            // if the playing animations conflict with the scrubbed animating attribuates.
            .sort(function (first) { return (first.needsScrub ? -1 : 1); });
        for (var _i = 0, activeAnimations_1 = activeAnimations; _i < activeAnimations_1.length; _i++) {
            var animation = activeAnimations_1[_i];
            animation.advance(elapsedTime);
            if (animation.instance.didLoop) {
                animation.loopCount += 1;
            }
            animation.apply(1.0);
        }
        // - Advance non-paused state machines by the elapsed number of seconds
        // - Advance to the first frame even when autoplay is false
        var activeStateMachines = this.animator.stateMachines.filter(function (a) { return a.playing; });
        // Instrument the first 3 frames so the Performance timeline shows precise
        // per-call latency for advance, draw, and flush without polluting the trace.
        var _perfFrame = this.enablePerfMarks && this.frameCount < 3 ? this.frameCount : -1;
        for (var _c = 0, activeStateMachines_1 = activeStateMachines; _c < activeStateMachines_1.length; _c++) {
            var stateMachine = activeStateMachines_1[_c];
            // Check for events before the current frame's state machine advance
            var numEventsReported = stateMachine.reportedEventCount();
            if (numEventsReported) {
                for (var i = 0; i < numEventsReported; i++) {
                    var event_1 = stateMachine.reportedEventAt(i);
                    if (event_1) {
                        if (event_1.type === RiveEventType.OpenUrl) {
                            this.eventManager.fire({
                                type: EventType.RiveEvent,
                                data: event_1,
                            });
                            // Handle the event side effect if explicitly enabled
                            if (this.automaticallyHandleEvents) {
                                var newAnchorTag = document.createElement("a");
                                var _d = event_1, url = _d.url, target = _d.target;
                                var sanitizedUrl = (0,_utils__WEBPACK_IMPORTED_MODULE_3__.sanitizeUrl)(url);
                                url && newAnchorTag.setAttribute("href", sanitizedUrl);
                                target && newAnchorTag.setAttribute("target", target);
                                if (sanitizedUrl && sanitizedUrl !== _utils__WEBPACK_IMPORTED_MODULE_3__.BLANK_URL) {
                                    newAnchorTag.click();
                                }
                            }
                        }
                        else {
                            this.eventManager.fire({
                                type: EventType.RiveEvent,
                                data: event_1,
                            });
                        }
                    }
                }
            }
            if (_perfFrame >= 0)
                performance.mark("rive:sm-advance:start:f".concat(_perfFrame));
            stateMachine.advanceAndApply(elapsedTime);
            if (_perfFrame >= 0) {
                performance.mark("rive:sm-advance:end:f".concat(_perfFrame));
                performance.measure("rive:sm-advance:f".concat(_perfFrame), "rive:sm-advance:start:f".concat(_perfFrame), "rive:sm-advance:end:f".concat(_perfFrame));
            }
            if (this._semanticsActive) {
                var diff = stateMachine.drainSemanticsDiff();
                if (diff) {
                    if (!this._semanticTree) {
                        this._semanticTree = new _semantics__WEBPACK_IMPORTED_MODULE_2__.SemanticTreeModel();
                    }
                    this._semanticTree.applyDiff(diff);
                }
            }
        }
        // Update the accessibility overlay after all state machines have
        // been advanced and their diffs applied to the tree model.
        if (this._semanticsActive &&
            this._semanticTree &&
            activeStateMachines.length > 0 &&
            this.canvas instanceof HTMLCanvasElement) {
            if (!this._accessibilityOverlay) {
                var mainSm_1 = activeStateMachines[0];
                this._accessibilityOverlay = new _semantics__WEBPACK_IMPORTED_MODULE_2__.AccessibilityOverlay({
                    canvas: this.canvas,
                    instanceId: this._instanceId,
                    semanticsOptions: this.semanticsOptions,
                    allowFocusInterrupt: this._focusOptions.allowFocusInterrupt,
                    isEditingHostFocused: this.isEditingHostFocused,
                    fireAction: function (nodeId, actionType) {
                        mainSm_1.fireSemanticAction(nodeId, actionType);
                    },
                    requestFocus: function (nodeId) {
                        return mainSm_1.focusSemanticNode(nodeId);
                    },
                    clearFocus: function () {
                        return mainSm_1.instance.clearFocus();
                    },
                });
            }
            var overlayChange = (_a = this._accessibilityOverlay) === null || _a === void 0 ? void 0 : _a.needsUpdate(this._semanticTree);
            if (overlayChange || this._overlayTransformDirty) {
                // Only recompute the artboard→canvas transform when something that
                // affects it changed (canvas geometry or a layout/dpr input). When only
                // the semantic tree changed we pass null and reuse the existing CSS
                // transform on the overlay container.
                var forwardMat = null;
                if ((overlayChange === null || overlayChange === void 0 ? void 0 : overlayChange.layoutChanged) || this._overlayTransformDirty) {
                    var fit_1 = this._layout.runtimeFit(this.runtime);
                    var alignment = this._layout.runtimeAlignment(this.runtime);
                    forwardMat = this.runtime.computeAlignment(fit_1, alignment, {
                        minX: this._layout.minX,
                        minY: this._layout.minY,
                        maxX: this._layout.maxX,
                        maxY: this._layout.maxY,
                    }, this.artboard.bounds, this._devicePixelRatioUsed * this._layout.layoutScaleFactor);
                    this._overlayTransformDirty = false;
                }
                this._accessibilityOverlay.update(this._semanticTree, forwardMat, this._devicePixelRatioUsed, this.artboard.bounds, overlayChange);
                forwardMat === null || forwardMat === void 0 ? void 0 : forwardMat.delete();
            }
        }
        // For linear animations that have been applied to the artboard, advance it
        // by the elapsed time.
        if (this.animator.stateMachines.length == 0) {
            this.artboard.advance(elapsedTime);
        }
        // Check for any animations that looped
        this.animator.handleLooping();
        // Check for any state machines that had a state change
        this.animator.handleStateChanges();
        // Report advanced time
        this.animator.handleAdvancing(elapsedTime);
        // Poll focus state to see whether or not to blur or pull up a virtual keyboard for any change to a text input node.
        this.pollFocusState();
        // Handle callbacks for main view model property changes
        (_b = this._viewModelInstance) === null || _b === void 0 ? void 0 : _b.handleCallbacks();
        // Handle callbacks for global view model property changes
        this._globalViewModelInstances.forEach(function (instance) {
            if (instance) {
                instance.handleCallbacks();
            }
        });
    };
    /**
     * Draw rendering loop; renders animation frames at the correct time interval.
     * @param time the time at which to render a frame
     */
    Rive.prototype.draw = function (time, onSecond) {
        // Clear the frameRequestId, as we're now rendering a fresh frame
        this.frameRequestId = null;
        // load() tears the artboard down and re-inits asynchronously; a frame
        // queued before that lands here with nothing to draw.
        if (!this.artboard) {
            return;
        }
        var before = performance.now();
        // Instrument the first 3 frames so the Performance timeline shows precise
        // per-call latency for advance, draw, and flush without polluting the trace.
        var _perfFrame = this.enablePerfMarks && this.frameCount < 3 ? this.frameCount : -1;
        // On the first pass, make sure lastTime has a valid value
        if (!this.lastRenderTime) {
            this.lastRenderTime = time;
        }
        // Handle the onSecond callback
        this.renderSecondTimer += time - this.lastRenderTime;
        if (this.renderSecondTimer > 5000) {
            this.renderSecondTimer = 0;
            onSecond === null || onSecond === void 0 ? void 0 : onSecond();
        }
        // Calculate the elapsed time between frames in seconds
        var elapsedTime = (time - this.lastRenderTime) / 1000;
        this.lastRenderTime = time;
        this.advanceAndReportChanges(elapsedTime);
        var renderer = this.renderer;
        // Do not draw on 0 canvas size
        if (!this._hasZeroSize) {
            // If there was no dirt on this frame, do not clear and draw. The deferred
            // term has to be read here, before `clear()` below: clearing opens the
            // session's recording window and marks its stream, so a read taken after
            // it reports every frame as dirty and nothing is ever skipped.
            if (this.drawOptimization == DrawOptimizationOptions.AlwaysDraw ||
                this.artboard.didChange() ||
                this._deferredWorkPending() ||
                this._needsRedraw ||
                this._canvasSizeChanged()) {
                // Canvas must be wiped to prevent artifacts
                renderer.clear();
                renderer.save();
                // Update the renderer alignment if necessary
                if (_perfFrame >= 0)
                    performance.mark("rive:align-renderer:start:f".concat(_perfFrame));
                this.alignRenderer();
                if (_perfFrame >= 0) {
                    performance.mark("rive:align-renderer:end:f".concat(_perfFrame));
                    performance.measure("rive:align-renderer:f".concat(_perfFrame), "rive:align-renderer:start:f".concat(_perfFrame), "rive:align-renderer:end:f".concat(_perfFrame));
                }
                if (_perfFrame >= 0)
                    performance.mark("rive:artboard-draw:start:f".concat(_perfFrame));
                this.artboard.draw(renderer);
                if (_perfFrame >= 0) {
                    performance.mark("rive:artboard-draw:end:f".concat(_perfFrame));
                    performance.measure("rive:artboard-draw:f".concat(_perfFrame), "rive:artboard-draw:start:f".concat(_perfFrame), "rive:artboard-draw:end:f".concat(_perfFrame));
                }
                renderer.restore();
                if (_perfFrame >= 0)
                    performance.mark("rive:renderer-flush:start:f".concat(_perfFrame));
                renderer.flush();
                if (_perfFrame >= 0) {
                    performance.mark("rive:renderer-flush:end:f".concat(_perfFrame));
                    performance.measure("rive:renderer-flush:f".concat(_perfFrame), "rive:renderer-flush:start:f".concat(_perfFrame), "rive:renderer-flush:end:f".concat(_perfFrame));
                }
                this._needsRedraw = false;
            }
        }
        // Add duration to create frame to durations array
        this.frameCount++;
        var after = performance.now();
        this.frameTimes.push(after);
        this.durations.push(after - before);
        while (this.frameTimes[0] <= after - 1000) {
            this.frameTimes.shift();
            this.durations.shift();
        }
        // Calling requestAnimationFrame will rerun draw() at the correct rate:
        // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_animations
        if (this.animator.isPlaying) {
            // Request a new rendering frame
            this.scheduleRendering();
        }
        else if (this.animator.isPaused) {
            // Reset the end time so on playback it starts at the correct frame
            this.lastRenderTime = 0;
        }
        else if (this.animator.isStopped) {
            // Reset animation instances, artboard and time
            // TODO: implement this properly when we have instancing
            // this.initArtboard();
            // this.drawFrame();
            this.lastRenderTime = 0;
        }
    };
    /**
     * Align the renderer
     */
    Rive.prototype.alignRenderer = function () {
        var _a = this, renderer = _a.renderer, runtime = _a.runtime, _layout = _a._layout, artboard = _a.artboard;
        // Align things up safe in the knowledge we can restore if changed
        renderer.align(_layout.runtimeFit(runtime), _layout.runtimeAlignment(runtime), {
            minX: _layout.minX,
            minY: _layout.minY,
            maxX: _layout.maxX,
            maxY: _layout.maxY,
        }, artboard.bounds, this._devicePixelRatioUsed * _layout.layoutScaleFactor);
    };
    Object.defineProperty(Rive.prototype, "fps", {
        get: function () {
            return this.durations.length;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "frameTime", {
        get: function () {
            if (this.durations.length === 0) {
                return 0;
            }
            return (this.durations.reduce(function (a, b) { return a + b; }, 0) / this.durations.length).toFixed(4);
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Cleans up all Wasm-generated objects that need to be manually destroyed:
     * artboard instances, animation instances, state machine instances,
     * renderer instance, file and runtime.
     *
     * Once this is called, you will need to initialise a new instance of the
     * Rive class
     */
    Rive.prototype.cleanup = function () {
        var _a, _b, _c, _d, _e;
        this.destroyed = true;
        // Stop the renderer if it hasn't already been stopped.
        this.stopRendering();
        // Make the GL context backing this renderer current before any WASM teardown
        // that frees GPU resources. Binding here covers the artboard/file deletes;
        // deleteRiveRenderer() re-binds for the renderer's own delete. No-op on the
        // canvas2d build
        (_b = (_a = this.renderer) === null || _a === void 0 ? void 0 : _a.bindContext) === null || _b === void 0 ? void 0 : _b.call(_a);
        // Clean up any artboard, animation or state machine instances.
        this.cleanupInstances();
        // Remove from observer
        if (this._observed !== null) {
            observers.remove(this._observed);
        }
        this.removeRiveListeners();
        // The file and its session go before the renderer: the session's replay
        // state lives in the renderer's context. But the renderer must let go of
        // the session first — its detach handle dies with session.delete(), and a
        // later detach would pass embind a deleted object.
        if (this.renderer) {
            (_d = (_c = this.renderer).detachSession) === null || _d === void 0 ? void 0 : _d.call(_c);
        }
        this.releaseCurrentRiveFile(/* isTeardown */ true);
        this.riveFile = null;
        this.deleteRiveRenderer();
        if (this._audioEventListener !== null) {
            audioManager.remove(this._audioEventListener);
            this._audioEventListener = null;
        }
        if (this._pageVisibilityHandler) {
            document.removeEventListener('visibilitychange', this._pageVisibilityHandler);
            this._pageVisibilityHandler = null;
        }
        (_e = this._viewModelInstance) === null || _e === void 0 ? void 0 : _e.cleanup();
        this._viewModelInstance = null;
        this._globalViewModelInstances.forEach(function (instance) { return instance.cleanup(); });
        this._globalViewModelInstances.clear();
        this._dataEnums = null;
    };
    /**
     * Drops this instance's hold on `this.riveFile`. A reference taken through
     * getInstance() is given back; a file we imported but never referenced is
     * released outright so its session goes with it. A caller-supplied file we
     * never referenced is left alone.
     *
     * `isTeardown` distinguishes cleanup() from a reload. Teardown always hands
     * the reference back, as it always has. A reload must not do that for a
     * caller-supplied file: a RiveFile carries no reference for its creator, so
     * releasing here would take the last one and destroy a file the caller still
     * holds.
     */
    Rive.prototype.releaseCurrentRiveFile = function (isTeardown) {
        var _a, _b;
        if (this.file) {
            if (isTeardown || this.ownsRiveFile) {
                (_a = this.riveFile) === null || _a === void 0 ? void 0 : _a.cleanup();
            }
            this.file = null;
        }
        else if (this.ownsRiveFile) {
            (_b = this.riveFile) === null || _b === void 0 ? void 0 : _b.destroyIfUnused();
        }
    };
    /**
     * Cleans up the Renderer object. Only call this API if you no longer
     * need to render Rive content in your session.
     */
    Rive.prototype.deleteRiveRenderer = function () {
        var _a, _b;
        if (this.renderer) {
            // A session outliving this renderer has to stop pointing at it, and its
            // replay state has to drop while this context is still alive. No-op when
            // nothing was ever attached.
            (_b = (_a = this.renderer).detachSession) === null || _b === void 0 ? void 0 : _b.call(_a);
            this.renderer.delete();
        }
        this.renderer = null;
    };
    Object.defineProperty(Rive.prototype, "deferredRendererActive", {
        /**
         * @experimental This API is early and may encounter breaking behavior change without a major version bump
         *
         * Whether this instance is rendering through a deferred session. False whenever
         * a fallback ran, whatever was requested.
         */
        get: function () {
            var _a, _b, _c;
            return (_c = (_b = (_a = this.renderer) === null || _a === void 0 ? void 0 : _a.deferredActive) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : false;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Cleans up any Wasm-generated objects that need to be manually destroyed:
     * artboard instances, animation instances, state machine instances.
     *
     * Once this is called, things will need to be reinitialized or bad things
     * might happen.
     */
    Rive.prototype.cleanupInstances = function () {
        var _a;
        if (this.eventCleanup !== null) {
            this.eventCleanup();
        }
        this.cleanupKeyboardInteractions();
        // Tear down semantics before deleting state machines — the overlay's action
        // closures point at instances that stop() is about to free.
        this.cleanupSemantics();
        // Delete all animation and state machine instances synchronously via the
        // animator
        (_a = this.animator) === null || _a === void 0 ? void 0 : _a.stop();
        if (this.artboard) {
            this.artboard.delete();
            this.artboard = null;
        }
    };
    /**
     * Tries to query the setup Artboard for a text run node with the given name.
     *
     * @param textRunName - Name of the text run node associated with a text object
     * @returns - TextValueRun node or undefined if the text run cannot be queried
     */
    Rive.prototype.retrieveTextRun = function (textRunName) {
        var _a;
        if (!textRunName) {
            console.warn("No text run name provided");
            return;
        }
        if (!this.artboard) {
            console.warn("Tried to access text run, but the Artboard is null");
            return;
        }
        var textRun = this.artboard.textRun(textRunName);
        if (!textRun) {
            console.warn("Could not access a text run with name '".concat(textRunName, "' in the '").concat((_a = this.artboard) === null || _a === void 0 ? void 0 : _a.name, "' Artboard. Note that you must rename a text run node in the Rive editor to make it queryable at runtime."));
            return;
        }
        return textRun;
    };
    /**
     * Returns a string from a given text run node name, or undefined if the text run
     * cannot be queried.
     *
     * @deprecated Text run APIs are deprecated: use data binding instead. See
     * {@link https://rive.app/docs/editor/data-binding/migration-guide#updating-text-runs-at-runtime}
     * for how to migrate.
     * @param textRunName - Name of the text run node associated with a text object
     * @returns - String value of the text run node or undefined
     */
    Rive.prototype.getTextRunValue = function (textRunName) {
        warnOnce(DeprecationKeys.textRuns, textRunsDeprecationWarning);
        var textRun = this.retrieveTextRun(textRunName);
        return textRun ? textRun.text : undefined;
    };
    /**
     * Sets a text value for a given text run node name if possible
     *
     * @deprecated Text run APIs are deprecated: use data binding instead. See
     * {@link https://rive.app/docs/editor/data-binding/migration-guide#updating-text-runs-at-runtime}
     * for how to migrate.
     * @param textRunName - Name of the text run node associated with a text object
     * @param textRunValue - String value to set on the text run node
     */
    Rive.prototype.setTextRunValue = function (textRunName, textRunValue) {
        warnOnce(DeprecationKeys.textRuns, textRunsDeprecationWarning);
        var textRun = this.retrieveTextRun(textRunName);
        if (textRun) {
            textRun.text = textRunValue;
        }
    };
    /**
     * Warns when playback-control names match linear animations in the
     * Animator's instanced context; state machine playback remain supported.
     *
     * Remove for v3 release
     */
    Rive.prototype.warnIfLinearAnimationNames = function (names, methodName) {
        if (this.animator &&
            this.animator.animations.some(function (a) { return names.includes(a.name); })) {
            warnDeprecatedAnimationNames(methodName);
        }
    };
    /**
     * Plays specified animations or state machines; if none specified, it
     * unpauses everything.
     * @param animationNames Animation or state machine name(s) to play.
     *
     * Deprecated usage: passing linear animation names (control playback with a
     * state machine instead) and passing an array of names (this parameter
     * becomes a single string in the next major version).
     */
    Rive.prototype.play = function (animationNames, autoplay) {
        var _this = this;
        warnIfNamesArray(animationNames, "play");
        var names = mapToStringArray(animationNames);
        // If the file's not loaded, queue up the play
        if (!this.readyForPlaying) {
            this.taskQueue.add({
                action: function () { return _this.play(animationNames, autoplay); },
            });
            return;
        }
        this.animator.play(names);
        this.warnIfLinearAnimationNames(names, "play");
        this.syncSemanticsOnStateMachines();
        if (this.eventCleanup) {
            this.eventCleanup();
        }
        this.cleanupKeyboardInteractions();
        this.setupRiveListeners();
        this.startRendering();
    };
    /**
     * Pauses specified animations or state machines; if none specified, pauses
     * all.
     * @param animationNames Animation or state machine name(s) to pause.
     *
     * Deprecated usage: passing linear animation names (control playback with a
     * state machine instead) and passing an array of names (this parameter
     * becomes a single string in the next major version).
     */
    Rive.prototype.pause = function (animationNames) {
        var _this = this;
        warnIfNamesArray(animationNames, "pause");
        var names = mapToStringArray(animationNames);
        // If the file's not loaded, early out, nothing to pause
        if (!this.readyForPlaying) {
            this.taskQueue.add({
                action: function () { return _this.pause(animationNames); },
            });
            return;
        }
        if (this.eventCleanup) {
            this.eventCleanup();
        }
        this.cleanupKeyboardInteractions();
        this.animator.pause(names);
        this.warnIfLinearAnimationNames(names, "pause");
    };
    /**
     * Scrubs specified animations to the given time; if none specified, scrubs
     * all of them.
     * @deprecated `scrub()` will be removed in a future major version: use a
     * state machine to control playback instead
     */
    Rive.prototype.scrub = function (animationNames, value) {
        var _this = this;
        warnOnce(DeprecationKeys.scrub, "`scrub()` is deprecated and will be removed in a future major version: " +
            "use a state machine to control playback instead.");
        var names = mapToStringArray(animationNames);
        // If the file's not loaded, early out, nothing to pause
        if (!this.readyForPlaying) {
            this.taskQueue.add({
                action: function () { return _this.scrub(animationNames, value); },
            });
            return;
        }
        // Scrub the animation time; we draw a single frame here so that if
        // nothing's currently playing, the scrubbed animation is still rendered/
        this.animator.scrub(names, value || 0);
        this.drawFrame();
    };
    /**
     * Stops specified animations or state machines; if none specified, stops
     * them all.
     * @param animationNames Animation or state machine name(s) to stop.
     *
     * Deprecated usage: passing linear animation names (control playback with a
     * state machine instead) and passing an array of names (this parameter
     * becomes a single string in the next major version).
     */
    Rive.prototype.stop = function (animationNames) {
        var _this = this;
        warnIfNamesArray(animationNames, "stop");
        var names = mapToStringArray(animationNames);
        // If the file's not loaded, early out, nothing to pause
        if (!this.readyForPlaying) {
            this.taskQueue.add({
                action: function () { return _this.stop(animationNames); },
            });
            return;
        }
        this.warnIfLinearAnimationNames(names, "stop");
        // If there is no artboard, this.animator will be undefined
        if (this.animator) {
            this.animator.stop(names);
        }
        if (this.eventCleanup) {
            this.eventCleanup();
        }
        this.cleanupKeyboardInteractions();
        this.cleanupSemantics();
    };
    /**
     * Resets the animation
     * @param artboard the name of the artboard, or default if none given
     * @param stateMachine the name of the state machine for playback
     * @param autoplay whether to autoplay when reset, defaults to false
     *
     */
    Rive.prototype.reset = function (params) {
        var _a, _b;
        // Get the current artboard, animations, state machines, and playback states
        var artBoardName = params === null || params === void 0 ? void 0 : params.artboard;
        var _c = resolveStartingPlayback({
            stateMachine: params === null || params === void 0 ? void 0 : params.stateMachine,
            animations: params === null || params === void 0 ? void 0 : params.animations,
            stateMachines: params === null || params === void 0 ? void 0 : params.stateMachines,
        }), animationNames = _c.startingAnimationNames, stateMachineNames = _c.startingStateMachineNames;
        var autoplay = (_a = params === null || params === void 0 ? void 0 : params.autoplay) !== null && _a !== void 0 ? _a : false;
        var autoBind = (_b = params === null || params === void 0 ? void 0 : params.autoBind) !== null && _b !== void 0 ? _b : false;
        // Stop everything and clean up
        this.cleanupInstances();
        // Reinitialize an artboard instance with the state
        this.initArtboard(artBoardName, animationNames, stateMachineNames, autoplay, autoBind);
        // Only drain the task queue once playback commands can execute; tasks
        // queued before then re-add themselves in a loop.
        if (this.readyForPlaying) {
            this.taskQueue.process();
        }
    };
    // Loads a new Rive file, keeping listeners in place
    Rive.prototype.load = function (params) {
        // Before stop(), so a call with no source leaves playback running.
        if (!params.src && !params.buffer && !params.riveFile) {
            throw new RiveError(Rive.missingErrorMessage);
        }
        // Stop all animations
        this.stop();
        // Reinitialize
        this.init(params);
    };
    Object.defineProperty(Rive.prototype, "layout", {
        /**
         * Returns the current layout. Note that layout should be treated as
         * immutable. If you want to change the layout, create a new one use the
         * layout setter
         */
        get: function () {
            return this._layout;
        },
        // Sets a new layout
        set: function (layout) {
            this._layout = layout;
            this.reportDisplayScale();
            // Fit/alignment/bounds feed the overlay transform.
            this._overlayTransformDirty = true;
            // If the maxX or maxY are 0, then set them to the canvas width and height
            if (!layout.maxX || !layout.maxY) {
                this.resizeToCanvas();
            }
            if (this.loaded && !this.animator.isPlaying) {
                this.drawFrame();
            }
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Sets the layout bounds to the current canvas size; this is typically called
     * when the canvas is resized
     */
    Rive.prototype.resizeToCanvas = function () {
        this._layout = this.layout.copyWith({
            minX: 0,
            minY: 0,
            maxX: this.canvas.width,
            maxY: this.canvas.height,
        });
        // Layout bounds feed the overlay transform.
        this._overlayTransformDirty = true;
    };
    /**
     * Accounts for devicePixelRatio as a multiplier to render the size of the canvas drawing surface.
     * Uses the size of the backing canvas to set new width/height attributes. Need to re-render
     * and resize the layout to match the new drawing surface afterwards.
     * Useful function for consumers to include in a window resize listener.
     *
     * This method will set the {@link devicePixelRatioUsed} property.
     *
     * Optionally, you can provide a {@link customDevicePixelRatio} to provide a
     * custom value.
     */
    Rive.prototype.resizeDrawingSurfaceToCanvas = function (customDevicePixelRatio) {
        if (this.canvas instanceof HTMLCanvasElement && !!window) {
            var _a = this.canvas.getBoundingClientRect(), width = _a.width, height = _a.height;
            var dpr = customDevicePixelRatio || window.devicePixelRatio || 1;
            this.devicePixelRatioUsed = dpr;
            this.canvas.width = dpr * width;
            this.canvas.height = dpr * height;
            this._needsRedraw = true;
            this.resizeToCanvas();
            if (this.layout.fit === Fit.Layout && this.artboard) {
                var scaleFactor = this._layout.layoutScaleFactor;
                this.artboard.width = width / scaleFactor;
                this.artboard.height = height / scaleFactor;
            }
            this.drawFrame();
        }
    };
    Object.defineProperty(Rive.prototype, "source", {
        // Returns the animation source, which may be undefined
        get: function () {
            return this.src;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "activeArtboard", {
        /**
         * Returns the name of the active artboard
         */
        get: function () {
            return this.artboard ? this.artboard.name : "";
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "semanticTree", {
        /**
         * Returns the semantic tree model when semantics are enabled, or null.
         * The overlay and external consumers use this to inspect the
         * current state of the semantic tree.
         */
        get: function () {
            return this._semanticTree;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "accessibilityOverlay", {
        /**
         * Returns the accessibility overlay when semantics are enabled, or null.
         * External consumers can use this to inspect the
         * current state of the accessibility overlay for this instance.
         */
        get: function () {
            return this._accessibilityOverlay;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "animationNames", {
        // Returns a list of animation names on the chosen artboard
        get: function () {
            // If the file's not loaded, we got nothing to return
            if (!this.loaded || !this.artboard) {
                return [];
            }
            var animationNames = [];
            for (var i = 0; i < this.artboard.animationCount(); i++) {
                animationNames.push(this.artboard.animationByIndex(i).name);
            }
            return animationNames;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "stateMachineNames", {
        /**
         * Returns a list of state machine names from the current artboard
         */
        get: function () {
            // If the file's not loaded, we got nothing to return
            if (!this.loaded || !this.artboard) {
                return [];
            }
            var stateMachineNames = [];
            for (var i = 0; i < this.artboard.stateMachineCount(); i++) {
                stateMachineNames.push(this.artboard.stateMachineByIndex(i).name);
            }
            return stateMachineNames;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Returns the inputs for the specified instanced state machine, or an empty
     * list if the name is invalid or the state machine is not instanced. Returns
     * undefined if the file is not loaded yet.
     *
     * @deprecated State machine inputs are deprecated: use data binding
     * properties instead. See
     * {@link https://rive.app/docs/editor/data-binding/migration-guide#state-machine-inputs}
     * for how to migrate.
     * @param name the state machine name
     * @returns the inputs for the named state machine or undefined
     */
    Rive.prototype.stateMachineInputs = function (name) {
        warnOnce(DeprecationKeys.stateMachineInputs, stateMachineInputsDeprecationWarning);
        // If the file's not loaded, early out, nothing to pause
        if (!this.loaded) {
            return;
        }
        var stateMachine = this.animator.stateMachines.find(function (m) { return m.name === name; });
        return stateMachine === null || stateMachine === void 0 ? void 0 : stateMachine.inputs;
    };
    // Returns the input with the provided name at the given path
    Rive.prototype.retrieveInputAtPath = function (name, path) {
        if (!name) {
            console.warn("No input name provided for path '".concat(path, "'"));
            return;
        }
        if (!this.artboard) {
            console.warn("Tried to access input: '".concat(name, "', at path: '").concat(path, "', but the Artboard is null"));
            return;
        }
        var input = this.artboard.inputByPath(name, path);
        if (!input) {
            console.warn("Could not access an input with name: '".concat(name, "', at path:'").concat(path, "'"));
            return;
        }
        return input;
    };
    /**
     * Set the boolean input with the provided name at the given path with value
     * @deprecated State machine inputs are deprecated: use data binding
     * properties instead. See
     * {@link https://rive.app/docs/editor/data-binding/migration-guide#state-machine-inputs}
     * for how to migrate.
     * @param input the state machine input name
     * @param value the value to set the input to
     * @param path the path the input is located at an artboard level
     */
    Rive.prototype.setBooleanStateAtPath = function (inputName, value, path) {
        warnOnce(DeprecationKeys.stateMachineInputs, stateMachineInputsDeprecationWarning);
        var input = this.retrieveInputAtPath(inputName, path);
        if (!input)
            return;
        if (input.type === StateMachineInputType.Boolean) {
            input.asBool().value = value;
        }
        else {
            console.warn("Input with name: '".concat(inputName, "', at path:'").concat(path, "' is not a boolean"));
        }
    };
    /**
     * Set the number input with the provided name at the given path with value
     * @deprecated State machine inputs are deprecated: use data binding
     * properties instead. See
     * {@link https://rive.app/docs/editor/data-binding/migration-guide#state-machine-inputs}
     * for how to migrate.
     * @param input the state machine input name
     * @param value the value to set the input to
     * @param path the path the input is located at an artboard level
     */
    Rive.prototype.setNumberStateAtPath = function (inputName, value, path) {
        warnOnce(DeprecationKeys.stateMachineInputs, stateMachineInputsDeprecationWarning);
        var input = this.retrieveInputAtPath(inputName, path);
        if (!input)
            return;
        if (input.type === StateMachineInputType.Number) {
            input.asNumber().value = value;
        }
        else {
            console.warn("Input with name: '".concat(inputName, "', at path:'").concat(path, "' is not a number"));
        }
    };
    /**
     * Fire the trigger with the provided name at the given path
     * @deprecated State machine inputs are deprecated: use data binding
     * properties instead. See
     * {@link https://rive.app/docs/editor/data-binding/migration-guide#state-machine-inputs}
     * for how to migrate.
     * @param input the state machine input name
     * @param path the path the input is located at an artboard level
     */
    Rive.prototype.fireStateAtPath = function (inputName, path) {
        warnOnce(DeprecationKeys.stateMachineInputs, stateMachineInputsDeprecationWarning);
        var input = this.retrieveInputAtPath(inputName, path);
        if (!input)
            return;
        if (input.type === StateMachineInputType.Trigger) {
            input.asTrigger().fire();
        }
        else {
            console.warn("Input with name: '".concat(inputName, "', at path:'").concat(path, "' is not a trigger"));
        }
    };
    // Returns the TextValueRun object for the provided name at the given path
    Rive.prototype.retrieveTextAtPath = function (name, path) {
        if (!name) {
            console.warn("No text name provided for path '".concat(path, "'"));
            return;
        }
        if (!path) {
            console.warn("No path provided for text '".concat(name, "'"));
            return;
        }
        if (!this.artboard) {
            console.warn("Tried to access text: '".concat(name, "', at path: '").concat(path, "', but the Artboard is null"));
            return;
        }
        var text = this.artboard.textByPath(name, path);
        if (!text) {
            console.warn("Could not access text with name: '".concat(name, "', at path:'").concat(path, "'"));
            return;
        }
        return text;
    };
    /**
     * Retrieves the text value for a specified text run at a given path
     * @param textName The name of the text run
     * @param path The path to the text run within the artboard
     * @returns The text value of the text run, or undefined if not found
     *
     * @example
     * // Get the text value for a text run named "title" at one nested artboard deep
     * const titleText = riveInstance.getTextRunValueAtPath("title", "artboard1");
     *
     * @example
     * // Get the text value for a text run named "subtitle" within a nested group two artboards deep
     * const subtitleText = riveInstance.getTextRunValueAtPath("subtitle", "group/nestedGroup");
     *
     * @remarks
     * If the text run cannot be found at the specified path, a warning will be logged to the console.
     *
     * @deprecated Text run APIs are deprecated: use data binding instead. See
     * {@link https://rive.app/docs/editor/data-binding/migration-guide#updating-text-runs-at-runtime}
     * for how to migrate.
     */
    Rive.prototype.getTextRunValueAtPath = function (textName, path) {
        warnOnce(DeprecationKeys.textRuns, textRunsDeprecationWarning);
        var run = this.retrieveTextAtPath(textName, path);
        if (!run) {
            console.warn("Could not get text with name: '".concat(textName, "', at path:'").concat(path, "'"));
            return;
        }
        return run.text;
    };
    /**
     * Sets the text value for a specified text run at a given path
     * @param textName The name of the text run
     * @param value The new text value to set
     * @param path The path to the text run within the artboard
     * @returns void
     *
     * @example
     * // Set the text value for a text run named "title" at one nested artboard deep
     * riveInstance.setTextRunValueAtPath("title", "New Title", "artboard1");
     *
     * @example
     * // Set the text value for a text run named "subtitle" within a nested group two artboards deep
     * riveInstance.setTextRunValueAtPath("subtitle", "New Subtitle", "group/nestedGroup");
     *
     * @remarks
     * If the text run cannot be found at the specified path, a warning will be logged to the console.
     *
     * @deprecated Text run APIs are deprecated: use data binding instead. See
     * {@link https://rive.app/docs/editor/data-binding/migration-guide#updating-text-runs-at-runtime}
     * for how to migrate.
     */
    Rive.prototype.setTextRunValueAtPath = function (textName, value, path) {
        warnOnce(DeprecationKeys.textRuns, textRunsDeprecationWarning);
        var run = this.retrieveTextAtPath(textName, path);
        if (!run) {
            console.warn("Could not set text with name: '".concat(textName, "', at path:'").concat(path, "'"));
            return;
        }
        run.text = value;
    };
    Object.defineProperty(Rive.prototype, "playingStateMachineNames", {
        // Returns a list of playing machine names
        get: function () {
            // If the file's not loaded, we got nothing to return
            if (!this.loaded) {
                return [];
            }
            return this.animator.stateMachines
                .filter(function (m) { return m.playing; })
                .map(function (m) { return m.name; });
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "playingAnimationNames", {
        // Returns a list of playing animation names
        get: function () {
            // If the file's not loaded, we got nothing to return
            if (!this.loaded) {
                return [];
            }
            return this.animator.animations.filter(function (a) { return a.playing; }).map(function (a) { return a.name; });
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "pausedAnimationNames", {
        // Returns a list of paused animation names
        get: function () {
            // If the file's not loaded, we got nothing to return
            if (!this.loaded) {
                return [];
            }
            return this.animator.animations
                .filter(function (a) { return !a.playing; })
                .map(function (a) { return a.name; });
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "pausedStateMachineNames", {
        /**
         *  Returns a list of paused machine names
         * @returns a list of state machine names that are paused
         */
        get: function () {
            // If the file's not loaded, we got nothing to return
            if (!this.loaded) {
                return [];
            }
            return this.animator.stateMachines
                .filter(function (m) { return !m.playing; })
                .map(function (m) { return m.name; });
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "isPlaying", {
        /**
         * @returns true if any animation is playing
         */
        get: function () {
            return this.animator.isPlaying;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "isPaused", {
        /**
         * @returns true if all instanced animations are paused
         */
        get: function () {
            return this.animator.isPaused;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "isStopped", {
        /**
         * @returns true if no animations are playing or paused
         */
        get: function () {
            var _a, _b;
            return (_b = (_a = this.animator) === null || _a === void 0 ? void 0 : _a.isStopped) !== null && _b !== void 0 ? _b : true;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "bounds", {
        /**
         * @returns the bounds of the current artboard, or undefined if the artboard
         * isn't loaded yet.
         */
        get: function () {
            return this.artboard ? this.artboard.bounds : undefined;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Subscribe to Rive-generated events
     *
     * Note: subscribing to {@link EventType.RiveEvent},
     * {@link EventType.StateChange}, or {@link EventType.Loop} is deprecated;
     * use data binding instead. See
     * {@link https://rive.app/docs/runtimes/web/rive-events} (Rive Events) and
     * {@link https://rive.app/docs/editor/data-binding/migration-guide} for how
     * to migrate Rive graphics to a data binding workflow instead.
     * @param type the type of event to subscribe to
     * @param callback callback to fire when the event occurs
     */
    Rive.prototype.on = function (type, callback) {
        if (type === EventType.RiveEvent) {
            warnOnce(DeprecationKeys.riveEvents, riveEventsDeprecationWarning);
        }
        else if (type === EventType.StateChange) {
            warnOnce(DeprecationKeys.stateChangeEvents, stateChangeEventsDeprecationWarning);
        }
        else if (type === EventType.Loop) {
            warnOnce(DeprecationKeys.loopEvents, loopEventsDeprecationWarning);
        }
        this.eventManager.add({
            type: type,
            callback: callback,
        });
    };
    /**
     * Unsubscribes from a Rive-generated event
     * @param type the type of event to unsubscribe from
     * @param callback the callback to unsubscribe
     */
    Rive.prototype.off = function (type, callback) {
        this.eventManager.remove({
            type: type,
            callback: callback,
        });
    };
    /**
     * Unsubscribes from a Rive-generated event
     * @deprecated
     * @param callback the callback to unsubscribe from
     */
    Rive.prototype.unsubscribe = function (type, callback) {
        warnOnce(DeprecationKeys.legacyUnsubscribe, "This function is deprecated: please use `off()` instead.");
        this.off(type, callback);
    };
    /**
     * Unsubscribes all Rive listeners from an event type, or everything if no type is
     * given
     * @param type the type of event to unsubscribe from, or all types if
     * undefined
     */
    Rive.prototype.removeAllRiveEventListeners = function (type) {
        this.eventManager.removeAll(type);
    };
    /**
     * Unsubscribes all listeners from an event type, or everything if no type is
     * given
     * @deprecated
     * @param type the type of event to unsubscribe from, or all types if
     * undefined
     */
    Rive.prototype.unsubscribeAll = function (type) {
        warnOnce(DeprecationKeys.legacyUnsubscribe, "This function is deprecated: please use `removeAllRiveEventListeners()` instead.");
        this.removeAllRiveEventListeners(type);
    };
    /**
     * Stops the rendering loop; this is different from pausing in that it doesn't
     * change the state of any animation. It stops rendering from occurring. This
     * is designed for situations such as when Rive isn't visible.
     *
     * The only way to start rendering again is to call `startRendering`.
     * Animations that are marked as playing will start from the position that
     * they would have been at if rendering had not been stopped.
     */
    Rive.prototype.stopRendering = function () {
        this._explicitlyStoppedRendering = true;
        if (this.loaded && this.frameRequestId) {
            if (this.runtime.cancelAnimationFrame) {
                this.runtime.cancelAnimationFrame(this.frameRequestId);
            }
            else {
                cancelAnimationFrame(this.frameRequestId);
            }
            this.frameRequestId = null;
        }
    };
    /**
     * Starts the rendering loop if it has been previously stopped. If the
     * renderer is already active, then this will have zero effect.
     */
    Rive.prototype.startRendering = function () {
        this._explicitlyStoppedRendering = false;
        this.drawFrame();
    };
    Rive.prototype.scheduleRendering = function () {
        if (this.loaded && this.artboard && !this.frameRequestId) {
            if (this.runtime.requestAnimationFrame) {
                this.frameRequestId = this.runtime.requestAnimationFrame(this._boundDraw);
            }
            else {
                this.frameRequestId = requestAnimationFrame(this._boundDraw);
            }
        }
    };
    /**
     * Called when document.visibilitychange fires (tab change, window minimize, etc.).
     * Cancels the rAF loop on hide and resets the time reference so that no accumulated time is
     * applied to state machines when the tab becomes visible again. This prevents state machine
     * advances with large time deltas when rAF starts up again.
     */
    Rive.prototype._onPageVisibilityChange = function () {
        var _a, _b;
        if (document.hidden) {
            if (this.frameRequestId !== null) {
                if ((_a = this.runtime) === null || _a === void 0 ? void 0 : _a.cancelAnimationFrame) {
                    this.runtime.cancelAnimationFrame(this.frameRequestId);
                }
                else {
                    cancelAnimationFrame(this.frameRequestId);
                }
                this.frameRequestId = null;
            }
            // Reset so the first resumed frame starts with elapsedTime === 0.
            this.lastRenderTime = 0;
        }
        else if (((_b = this.animator) === null || _b === void 0 ? void 0 : _b.isPlaying) && !this._explicitlyStoppedRendering) {
            this.scheduleRendering();
        }
    };
    /**
     * Enables frames-per-second (FPS) reporting for the runtime
     * If no callback is provided, Rive will append a fixed-position div at the top-right corner of
     * the page with the FPS reading
     * @param fpsCallback - Callback from the runtime during the RAF loop that supplies the FPS value
     */
    Rive.prototype.enableFPSCounter = function (fpsCallback) {
        this.runtime.enableFPSCounter(fpsCallback);
    };
    /**
     * Disables frames-per-second (FPS) reporting for the runtime
     */
    Rive.prototype.disableFPSCounter = function () {
        this.runtime.disableFPSCounter();
    };
    Object.defineProperty(Rive.prototype, "contents", {
        /**
         * Returns the contents of a Rive file: the artboards, animations, and state machines
         */
        get: function () {
            if (!this.loaded) {
                return undefined;
            }
            var riveContents = {
                artboards: [],
            };
            for (var i = 0; i < this.file.artboardCount(); i++) {
                var artboard = this.file.artboardByIndex(i);
                var artboardContents = {
                    name: artboard.name,
                    animations: [],
                    stateMachines: [],
                };
                for (var j = 0; j < artboard.animationCount(); j++) {
                    var animation = artboard.animationByIndex(j);
                    artboardContents.animations.push(animation.name);
                }
                for (var k = 0; k < artboard.stateMachineCount(); k++) {
                    var stateMachine = artboard.stateMachineByIndex(k);
                    var name_2 = stateMachine.name;
                    var instance = new this.runtime.StateMachineInstance(stateMachine, artboard);
                    var inputContents = [];
                    for (var l = 0; l < instance.inputCount(); l++) {
                        var input = instance.input(l);
                        inputContents.push({ name: input.name, type: input.type });
                    }
                    artboardContents.stateMachines.push({
                        name: name_2,
                        inputs: inputContents,
                    });
                }
                riveContents.artboards.push(artboardContents);
            }
            return riveContents;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "volume", {
        /**
         * Getter / Setter for the volume of the artboard
         */
        get: function () {
            if (this.artboard && this.artboard.volume !== this._volume) {
                this._volume = this.artboard.volume;
            }
            return this._volume;
        },
        set: function (value) {
            this._volume = value;
            if (this.artboard) {
                this.artboard.volume = value * audioManager.systemVolume;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "artboardWidth", {
        /**
         * The width of the artboard.
         *
         * This will return 0 if the artboard is not loaded yet and a custom
         * width has not been set.
         *
         * Do not set this value manually when using {@link resizeDrawingSurfaceToCanvas}
         * with a {@link Layout.fit} of {@link Fit.Layout}, as the artboard width is
         * automatically set.
         */
        get: function () {
            var _a;
            if (this.artboard) {
                return this.artboard.width;
            }
            return (_a = this._artboardWidth) !== null && _a !== void 0 ? _a : 0;
        },
        set: function (value) {
            this._artboardWidth = value;
            if (this.artboard) {
                this.artboard.width = value;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "artboardHeight", {
        /**
         * The height of the artboard.
         *
         * This will return 0 if the artboard is not loaded yet and a custom
         * height has not been set.
         *
         * Do not set this value manually when using {@link resizeDrawingSurfaceToCanvas}
         * with a {@link Layout.fit} of {@link Fit.Layout}, as the artboard height is
         * automatically set.
         */
        get: function () {
            var _a;
            if (this.artboard) {
                return this.artboard.height;
            }
            return (_a = this._artboardHeight) !== null && _a !== void 0 ? _a : 0;
        },
        set: function (value) {
            this._artboardHeight = value;
            if (this.artboard) {
                this.artboard.height = value;
            }
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Reset the artboard size to its original values.
     */
    Rive.prototype.resetArtboardSize = function () {
        if (this.artboard) {
            this.artboard.resetArtboardSize();
            this._artboardWidth = this.artboard.width;
            this._artboardHeight = this.artboard.height;
        }
        else {
            // If the artboard isn't loaded, we need to reset the custom width and height
            this._artboardWidth = undefined;
            this._artboardHeight = undefined;
        }
    };
    Object.defineProperty(Rive.prototype, "devicePixelRatioUsed", {
        /**
         * The device pixel ratio used in rendering and canvas/artboard resizing.
         *
         * This value will be overidden by the device pixel ratio used in
         * {@link resizeDrawingSurfaceToCanvas}. If you use that method, do not set this value.
         */
        get: function () {
            return this._devicePixelRatioUsed;
        },
        set: function (value) {
            if (value !== this._devicePixelRatioUsed) {
                this._overlayTransformDirty = true;
            }
            this._devicePixelRatioUsed = value;
            this.reportDisplayScale();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Rive.prototype, "inkbleed", {
        /**
         * @experimental (WebGL2 only) Whether inkbleed antialiasing is in effect. Can only be
         * turned on if `enableInkbleed: true` was passed at construction.
         */
        get: function () {
            return this._inkbleedCapable && this._inkbleed;
        },
        set: function (value) {
            if (!this._inkbleedCapable) {
                if (value && !Rive.inkbleedNotCapableWarned) {
                    Rive.inkbleedNotCapableWarned = true;
                    console.warn("Rive: `inkbleed` can't be enabled on this instance. It needs `enableInkbleed: true` at construction, on @rive-app/webgl2 without `useOffscreenRenderer`.");
                }
                return;
            }
            this._inkbleed = value;
            if (this.renderer) {
                this.applyInkbleed();
            }
            this._needsRedraw = true;
            this.drawFrame();
        },
        enumerable: false,
        configurable: true
    });
    Rive.prototype.applyInkbleed = function () {
        var enabled = this._inkbleed;
        var setInkbleed = this.renderer.setInkbleed;
        var supported = typeof setInkbleed === "function"
            ? setInkbleed.call(this.renderer, enabled)
            : !enabled;
        if (!supported) {
            this._inkbleedCapable = false;
            if (!Rive.inkbleedUnsupportedWarned) {
                Rive.inkbleedUnsupportedWarned = true;
                console.warn("Rive: `inkbleed` is not supported by this renderer (it needs @rive-app/webgl2 without `useOffscreenRenderer`, and a canvas context with depth and stencil). Rendering without it.");
            }
        }
    };
    // Not per frame: the scale is per file, and instances sharing one would trade
    // it every frame.
    Rive.prototype.reportDisplayScale = function () {
        var _a;
        (_a = this.file) === null || _a === void 0 ? void 0 : _a.displayScale(this._devicePixelRatioUsed * this._layout.layoutScaleFactor);
    };
    /**
     * Sets the main view model instance and applies it (rebinds). Equivalent to
     * `setViewModelInstance(vmi)` followed by `bind()`.
     */
    Rive.prototype.bindViewModelInstance = function (viewModelInstance) {
        if (!viewModelInstance) {
            return;
        }
        this.setViewModelInstance(viewModelInstance);
        this.bind();
    };
    /**
     * Sets the main view model instance in the data context WITHOUT rebinding.
     * Call {@link bind} to apply. Use this with {@link setGlobalViewModelInstance}
     * to batch multiple changes into a single rebind.
     */
    Rive.prototype.setViewModelInstance = function (viewModelInstance) {
        var _a;
        var runtimeInstance = viewModelInstance === null || viewModelInstance === void 0 ? void 0 : viewModelInstance.runtimeInstance;
        if (!this.artboard ||
            this.destroyed ||
            !viewModelInstance ||
            !runtimeInstance) {
            return;
        }
        viewModelInstance.internalIncrementReferenceCount();
        (_a = this._viewModelInstance) === null || _a === void 0 ? void 0 : _a.cleanup();
        this._viewModelInstance = viewModelInstance;
        if (this.animator.stateMachines.length > 0) {
            this.animator.stateMachines.forEach(function (stateMachine) {
                return stateMachine.instance.setViewModelInstance(runtimeInstance);
            });
        }
        else {
            this.artboard.setViewModelInstance(runtimeInstance);
        }
    };
    /**
     * Applies any pending `set*` view model instance changes by rebinding the
     * data binds once.
     * Implicitly creates and binds any view models that have not been set.
     */
    Rive.prototype.bind = function () {
        if (!this.artboard || this.destroyed) {
            return;
        }
        if (this.animator.stateMachines.length > 0) {
            this.animator.stateMachines.forEach(function (stateMachine) {
                return stateMachine.instance.bind();
            });
        }
        else {
            this.artboard.bind();
        }
    };
    Object.defineProperty(Rive.prototype, "viewModelInstance", {
        get: function () {
            return this._viewModelInstance;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Sets (or replaces) the global view model instance for the given global view
     * model name in the data context WITHOUT rebinding. The main instance and any
     * other globals keep their order. Call {@link bind} to apply — batch several
     * `set*` calls then a single `bind()` to avoid rebinding per set.
     * @param name - the name of the global view model
     * @param viewModelInstance - the instance to set for that global
     * @returns whether the instance was set (false if `name` does not match a
     * global view model in the file)
     */
    Rive.prototype.setGlobalViewModelInstance = function (name, viewModelInstance) {
        var _a;
        var runtimeInstance = viewModelInstance === null || viewModelInstance === void 0 ? void 0 : viewModelInstance.runtimeInstance;
        if (!this.artboard || this.destroyed || !runtimeInstance) {
            return false;
        }
        var bound = false;
        if (this.animator.stateMachines.length > 0) {
            this.animator.stateMachines.forEach(function (stateMachine) {
                if (stateMachine.instance.setGlobalViewModelInstance(name, runtimeInstance)) {
                    bound = true;
                }
            });
        }
        else {
            bound = this.artboard.setGlobalViewModelInstance(name, runtimeInstance);
        }
        if (bound) {
            viewModelInstance.internalIncrementReferenceCount();
            (_a = this._globalViewModelInstances.get(name)) === null || _a === void 0 ? void 0 : _a.cleanup();
            this._globalViewModelInstances.set(name, viewModelInstance);
        }
        return bound;
    };
    /**
     * @param name - the name of the global view model
     * @returns the global view model instance bound under the given name — the
     * instance set via {@link setGlobalViewModelInstance} or one created by
     * auto-bind — or null if none has been set/created for that name (globals are
     * not auto-created; the getter never creates one).
     */
    Rive.prototype.globalViewModelInstance = function (name) {
        var cached = this._globalViewModelInstances.get(name);
        if (cached) {
            return cached;
        }
        if (!this.artboard || this.destroyed) {
            return null;
        }
        // State machines share the artboard's data context; query the first one
        // when present (mirroring how the setter routes), otherwise the artboard.
        // This is a pure read — it returns null unless an instance was set/bound.
        var runtimeInstance = this.animator.stateMachines.length > 0
            ? this.animator.stateMachines[0].instance.globalViewModelInstance(name)
            : this.artboard.globalViewModelInstance(name);
        if (runtimeInstance === null) {
            return null;
        }
        var viewModelInstance = new ViewModelInstance(runtimeInstance, null);
        (0,_utils__WEBPACK_IMPORTED_MODULE_3__.createFinalization)(viewModelInstance, runtimeInstance);
        viewModelInstance.internalIncrementReferenceCount();
        this._globalViewModelInstances.set(name, viewModelInstance);
        return viewModelInstance;
    };
    /**
     * @returns the names of the file's global view models, in file order. Use
     * these with {@link setGlobalViewModelInstance} / {@link globalViewModelInstance}.
     */
    Rive.prototype.globalViewModelNames = function () {
        var _a, _b;
        return (_b = (_a = this.file) === null || _a === void 0 ? void 0 : _a.globalViewModelNames()) !== null && _b !== void 0 ? _b : [];
    };
    Rive.prototype.viewModelByIndex = function (index) {
        var viewModel = this.file.viewModelByIndex(index);
        if (viewModel !== null) {
            return new ViewModel(viewModel);
        }
        return null;
    };
    Rive.prototype.viewModelByName = function (name) {
        var _a;
        return (_a = this.riveFile) === null || _a === void 0 ? void 0 : _a.viewModelByName(name);
    };
    Rive.prototype.enums = function () {
        if (this._dataEnums === null) {
            var dataEnums = this.file.enums();
            this._dataEnums = dataEnums.map(function (dataEnum) {
                return new DataEnum(dataEnum);
            });
        }
        return this._dataEnums;
    };
    Rive.prototype.defaultViewModel = function () {
        if (this.artboard) {
            var viewModel = this.file.defaultArtboardViewModel(this.artboard);
            if (viewModel) {
                return new ViewModel(viewModel);
            }
        }
        return null;
    };
    /**
     * @deprecated This function is deprecated. For better stability and memory management
     * use `getBindableArtboard()` instead.
     * @param {string} name - The name of the artboard.
     * @returns {Artboard} The artboard to bind to.
     */
    Rive.prototype.getArtboard = function (name) {
        var _a, _b;
        return (_b = (_a = this.riveFile) === null || _a === void 0 ? void 0 : _a.getArtboard(name)) !== null && _b !== void 0 ? _b : null;
    };
    Rive.prototype.getBindableArtboard = function (name) {
        var _a, _b;
        return (_b = (_a = this.riveFile) === null || _a === void 0 ? void 0 : _a.getBindableArtboard(name)) !== null && _b !== void 0 ? _b : null;
    };
    Rive.prototype.getDefaultBindableArtboard = function () {
        var _a, _b;
        return (_b = (_a = this.riveFile) === null || _a === void 0 ? void 0 : _a.getDefaultBindableArtboard()) !== null && _b !== void 0 ? _b : null;
    };
    /**
     * Clear focus applicable to active state machines with focus nodes. Useful if users want to
     * reset focus state and behavior within the Rive graphic at any point (i.e. blurring off the canvas)
     */
    Rive.prototype.clearFocus = function () {
        var playingStateMachines = this.animator.stateMachines.filter(function (sm) { return sm.playing && sm.hasFocusNodes; });
        playingStateMachines.forEach(function (sm) { return sm.clearFocus(); });
    };
    Rive.inkbleedUnsupportedWarned = false;
    Rive.inkbleedNotCapableWarned = false;
    // Error message for missing source or buffer
    Rive.missingErrorMessage = "Rive source file or data buffer required";
    // Error message for removed rive file
    Rive.cleanupErrorMessage = "Attempt to use file after calling cleanup.";
    return Rive;
}());

var DataType;
(function (DataType) {
    DataType["none"] = "none";
    DataType["string"] = "string";
    DataType["number"] = "number";
    DataType["boolean"] = "boolean";
    DataType["color"] = "color";
    DataType["list"] = "list";
    DataType["enumType"] = "enumType";
    DataType["trigger"] = "trigger";
    DataType["viewModel"] = "viewModel";
    DataType["integer"] = "integer";
    DataType["listIndex"] = "listIndex";
    DataType["image"] = "image";
    DataType["artboard"] = "artboard";
})(DataType || (DataType = {}));
var ViewModel = /** @class */ (function () {
    function ViewModel(viewModel) {
        this._viewModel = viewModel;
    }
    Object.defineProperty(ViewModel.prototype, "instanceCount", {
        get: function () {
            return this._viewModel.instanceCount;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ViewModel.prototype, "name", {
        get: function () {
            return this._viewModel.name;
        },
        enumerable: false,
        configurable: true
    });
    ViewModel.prototype.instanceByIndex = function (index) {
        var instance = this._viewModel.instanceByIndex(index);
        if (instance !== null) {
            var viewModelInstance = new ViewModelInstance(instance, null);
            (0,_utils__WEBPACK_IMPORTED_MODULE_3__.createFinalization)(viewModelInstance, instance);
            return viewModelInstance;
        }
        return null;
    };
    ViewModel.prototype.instanceByName = function (name) {
        var instance = this._viewModel.instanceByName(name);
        if (instance !== null) {
            var viewModelInstance = new ViewModelInstance(instance, null);
            (0,_utils__WEBPACK_IMPORTED_MODULE_3__.createFinalization)(viewModelInstance, instance);
            return viewModelInstance;
        }
        return null;
    };
    ViewModel.prototype.defaultInstance = function () {
        var runtimeInstance = this._viewModel.defaultInstance();
        if (runtimeInstance !== null) {
            var viewModelInstance = new ViewModelInstance(runtimeInstance, null);
            (0,_utils__WEBPACK_IMPORTED_MODULE_3__.createFinalization)(viewModelInstance, runtimeInstance);
            return viewModelInstance;
        }
        return null;
    };
    ViewModel.prototype.instance = function () {
        var runtimeInstance = this._viewModel.instance();
        if (runtimeInstance !== null) {
            var viewModelInstance = new ViewModelInstance(runtimeInstance, null);
            (0,_utils__WEBPACK_IMPORTED_MODULE_3__.createFinalization)(viewModelInstance, runtimeInstance);
            return viewModelInstance;
        }
        return null;
    };
    Object.defineProperty(ViewModel.prototype, "properties", {
        get: function () {
            return this._viewModel.getProperties();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ViewModel.prototype, "instanceNames", {
        get: function () {
            return this._viewModel.getInstanceNames();
        },
        enumerable: false,
        configurable: true
    });
    return ViewModel;
}());

var DataEnum = /** @class */ (function () {
    function DataEnum(dataEnum) {
        this._dataEnum = dataEnum;
    }
    Object.defineProperty(DataEnum.prototype, "name", {
        get: function () {
            return this._dataEnum.name;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(DataEnum.prototype, "values", {
        get: function () {
            return this._dataEnum.values;
        },
        enumerable: false,
        configurable: true
    });
    return DataEnum;
}());

var PropertyType;
(function (PropertyType) {
    PropertyType["Number"] = "number";
    PropertyType["String"] = "string";
    PropertyType["Boolean"] = "boolean";
    PropertyType["Color"] = "color";
    PropertyType["Trigger"] = "trigger";
    PropertyType["Enum"] = "enum";
    PropertyType["List"] = "list";
    PropertyType["Image"] = "image";
    PropertyType["Font"] = "font";
    PropertyType["Artboard"] = "artboard";
})(PropertyType || (PropertyType = {}));
var ViewModelInstance = /** @class */ (function () {
    function ViewModelInstance(runtimeInstance, parent) {
        this._parents = [];
        this._children = [];
        this._viewModelInstances = new Map();
        this._propertiesWithCallbacks = [];
        this._referenceCount = 0;
        this.selfUnref = false;
        this._runtimeInstance = runtimeInstance;
        if (parent !== null) {
            this._parents.push(parent);
        }
    }
    Object.defineProperty(ViewModelInstance.prototype, "runtimeInstance", {
        get: function () {
            return this._runtimeInstance;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ViewModelInstance.prototype, "nativeInstance", {
        get: function () {
            return this._runtimeInstance;
        },
        enumerable: false,
        configurable: true
    });
    ViewModelInstance.prototype.handleCallbacks = function () {
        if (this._propertiesWithCallbacks.length !== 0) {
            this._propertiesWithCallbacks.forEach(function (property) {
                property.handleCallbacks();
            });
            this._propertiesWithCallbacks.forEach(function (property) {
                property.clearChanges();
            });
        }
        this._children.forEach(function (child) { return child.handleCallbacks(); });
    };
    ViewModelInstance.prototype.addParent = function (parent) {
        if (!this._parents.includes(parent)) {
            this._parents.push(parent);
            if (this._propertiesWithCallbacks.length > 0 ||
                this._children.length > 0) {
                parent.addToViewModelCallbacks(this);
            }
        }
    };
    ViewModelInstance.prototype.removeParent = function (parent) {
        var index = this._parents.indexOf(parent);
        if (index !== -1) {
            var parent_1 = this._parents[index];
            parent_1.removeFromViewModelCallbacks(this);
            this._parents.splice(index, 1);
        }
    };
    /*
     * method for internal use, it shouldn't be called externally
     */
    ViewModelInstance.prototype.addToPropertyCallbacks = function (property) {
        var _this = this;
        if (!this._propertiesWithCallbacks.includes(property)) {
            this._propertiesWithCallbacks.push(property);
            if (this._propertiesWithCallbacks.length > 0) {
                this._parents.forEach(function (parent) {
                    parent.addToViewModelCallbacks(_this);
                });
            }
        }
    };
    /*
     * method for internal use, it shouldn't be called externally
     */
    ViewModelInstance.prototype.removeFromPropertyCallbacks = function (property) {
        var _this = this;
        if (this._propertiesWithCallbacks.includes(property)) {
            this._propertiesWithCallbacks = this._propertiesWithCallbacks.filter(function (prop) { return prop !== property; });
            if (this._children.length === 0 &&
                this._propertiesWithCallbacks.length === 0) {
                this._parents.forEach(function (parent) {
                    parent.removeFromViewModelCallbacks(_this);
                });
            }
        }
    };
    /*
     * method for internal use, it shouldn't be called externally
     */
    ViewModelInstance.prototype.addToViewModelCallbacks = function (instance) {
        var _this = this;
        if (!this._children.includes(instance)) {
            this._children.push(instance);
            this._parents.forEach(function (parent) {
                parent.addToViewModelCallbacks(_this);
            });
        }
    };
    /*
     * method for internal use, it shouldn't be called externally
     */
    ViewModelInstance.prototype.removeFromViewModelCallbacks = function (instance) {
        var _this = this;
        if (this._children.includes(instance)) {
            this._children = this._children.filter(function (child) { return child !== instance; });
            if (this._children.length === 0 &&
                this._propertiesWithCallbacks.length === 0) {
                this._parents.forEach(function (parent) {
                    parent.removeFromViewModelCallbacks(_this);
                });
            }
        }
    };
    ViewModelInstance.prototype.clearCallbacks = function () {
        this._propertiesWithCallbacks.forEach(function (property) {
            property.clearCallbacks();
        });
    };
    ViewModelInstance.prototype.propertyFromPath = function (path, type) {
        var pathSegments = path.split("/");
        return this.propertyFromPathSegments(pathSegments, 0, type);
    };
    ViewModelInstance.prototype.viewModelFromPathSegments = function (pathSegments, index) {
        var viewModelInstance = this.internalViewModelInstance(pathSegments[index]);
        if (viewModelInstance !== null) {
            if (index == pathSegments.length - 1) {
                return viewModelInstance;
            }
            else {
                return viewModelInstance.viewModelFromPathSegments(pathSegments, index++);
            }
        }
        return null;
    };
    ViewModelInstance.prototype.propertyFromPathSegments = function (pathSegments, index, type) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
        if (index < pathSegments.length - 1) {
            var viewModelInstance = this.internalViewModelInstance(pathSegments[index]);
            if (viewModelInstance !== null) {
                return viewModelInstance.propertyFromPathSegments(pathSegments, index + 1, type);
            }
            else {
                return null;
            }
        }
        var instance = null;
        switch (type) {
            case PropertyType.Number:
                instance = (_b = (_a = this._runtimeInstance) === null || _a === void 0 ? void 0 : _a.number(pathSegments[index])) !== null && _b !== void 0 ? _b : null;
                if (instance !== null) {
                    return new ViewModelInstanceNumber(instance, this);
                }
                break;
            case PropertyType.String:
                instance = (_d = (_c = this._runtimeInstance) === null || _c === void 0 ? void 0 : _c.string(pathSegments[index])) !== null && _d !== void 0 ? _d : null;
                if (instance !== null) {
                    return new ViewModelInstanceString(instance, this);
                }
                break;
            case PropertyType.Boolean:
                instance = (_f = (_e = this._runtimeInstance) === null || _e === void 0 ? void 0 : _e.boolean(pathSegments[index])) !== null && _f !== void 0 ? _f : null;
                if (instance !== null) {
                    return new ViewModelInstanceBoolean(instance, this);
                }
                break;
            case PropertyType.Color:
                instance = (_h = (_g = this._runtimeInstance) === null || _g === void 0 ? void 0 : _g.color(pathSegments[index])) !== null && _h !== void 0 ? _h : null;
                if (instance !== null) {
                    return new ViewModelInstanceColor(instance, this);
                }
                break;
            case PropertyType.Trigger:
                instance = (_k = (_j = this._runtimeInstance) === null || _j === void 0 ? void 0 : _j.trigger(pathSegments[index])) !== null && _k !== void 0 ? _k : null;
                if (instance !== null) {
                    return new ViewModelInstanceTrigger(instance, this);
                }
                break;
            case PropertyType.Enum:
                instance = (_m = (_l = this._runtimeInstance) === null || _l === void 0 ? void 0 : _l.enum(pathSegments[index])) !== null && _m !== void 0 ? _m : null;
                if (instance !== null) {
                    return new ViewModelInstanceEnum(instance, this);
                }
                break;
            case PropertyType.List:
                instance = (_p = (_o = this._runtimeInstance) === null || _o === void 0 ? void 0 : _o.list(pathSegments[index])) !== null && _p !== void 0 ? _p : null;
                if (instance !== null) {
                    return new ViewModelInstanceList(instance, this);
                }
                break;
            case PropertyType.Image:
                instance = (_r = (_q = this._runtimeInstance) === null || _q === void 0 ? void 0 : _q.image(pathSegments[index])) !== null && _r !== void 0 ? _r : null;
                if (instance !== null) {
                    return new ViewModelInstanceAssetImage(instance, this);
                }
                break;
            case PropertyType.Font:
                instance = (_t = (_s = this._runtimeInstance) === null || _s === void 0 ? void 0 : _s.font(pathSegments[index])) !== null && _t !== void 0 ? _t : null;
                if (instance !== null) {
                    return new ViewModelInstanceAssetFont(instance, this);
                }
                break;
            case PropertyType.Artboard:
                instance = (_v = (_u = this._runtimeInstance) === null || _u === void 0 ? void 0 : _u.artboard(pathSegments[index])) !== null && _v !== void 0 ? _v : null;
                if (instance !== null) {
                    return new ViewModelInstanceArtboard(instance, this);
                }
                break;
        }
        return null;
    };
    ViewModelInstance.prototype.internalViewModelInstance = function (name) {
        var _a;
        if (this._viewModelInstances.has(name)) {
            return this._viewModelInstances.get(name);
        }
        var viewModelRuntimeInstance = (_a = this._runtimeInstance) === null || _a === void 0 ? void 0 : _a.viewModel(name);
        if (viewModelRuntimeInstance !== null) {
            var viewModelInstance = new ViewModelInstance(viewModelRuntimeInstance, this);
            (0,_utils__WEBPACK_IMPORTED_MODULE_3__.createFinalization)(viewModelInstance, viewModelRuntimeInstance);
            viewModelInstance.internalIncrementReferenceCount();
            this._viewModelInstances.set(name, viewModelInstance);
            return viewModelInstance;
        }
        return null;
    };
    /**
     * method to access a property instance of type number belonging
     * to the view model instance or to a nested view model instance
     * @param path - path to the number property
     */
    ViewModelInstance.prototype.number = function (path) {
        var viewmodelInstanceValue = this.propertyFromPath(path, PropertyType.Number);
        return viewmodelInstanceValue;
    };
    /**
     * method to access a property instance of type string belonging
     * to the view model instance or to a nested view model instance
     * @param path - path to the string property
     */
    ViewModelInstance.prototype.string = function (path) {
        var viewmodelInstanceValue = this.propertyFromPath(path, PropertyType.String);
        return viewmodelInstanceValue;
    };
    /**
     * method to access a property instance of type boolean belonging
     * to the view model instance or to a nested view model instance
     * @param path - path to the boolean property
     */
    ViewModelInstance.prototype.boolean = function (path) {
        var viewmodelInstanceValue = this.propertyFromPath(path, PropertyType.Boolean);
        return viewmodelInstanceValue;
    };
    /**
     * method to access a property instance of type color belonging
     * to the view model instance or to a nested view model instance
     * @param path - path to the ttrigger property
     */
    ViewModelInstance.prototype.color = function (path) {
        var viewmodelInstanceValue = this.propertyFromPath(path, PropertyType.Color);
        return viewmodelInstanceValue;
    };
    /**
     * method to access a property instance of type trigger belonging
     * to the view model instance or to a nested view model instance
     * @param path - path to the trigger property
     */
    ViewModelInstance.prototype.trigger = function (path) {
        var viewmodelInstanceValue = this.propertyFromPath(path, PropertyType.Trigger);
        return viewmodelInstanceValue;
    };
    /**
     * method to access a property instance of type enum belonging
     * to the view model instance or to a nested view model instance
     * @param path - path to the enum property
     */
    ViewModelInstance.prototype.enum = function (path) {
        var viewmodelInstanceValue = this.propertyFromPath(path, PropertyType.Enum);
        return viewmodelInstanceValue;
    };
    /**
     * method to access a property instance of type list belonging
     * to the view model instance or to a nested view model instance
     * @param path - path to the list property
     */
    ViewModelInstance.prototype.list = function (path) {
        var viewmodelInstanceValue = this.propertyFromPath(path, PropertyType.List);
        return viewmodelInstanceValue;
    };
    /**
     * method to access a view model property instance belonging
     * to the view model instance or to a nested view model instance
     * @param path - path to the image property
     */
    ViewModelInstance.prototype.image = function (path) {
        var viewmodelInstanceValue = this.propertyFromPath(path, PropertyType.Image);
        return viewmodelInstanceValue;
    };
    /**
     * method to access a view model property instance belonging
     * to the view model instance or to a nested view model instance
     * @param path - path to the font property
     */
    ViewModelInstance.prototype.font = function (path) {
        var viewmodelInstanceValue = this.propertyFromPath(path, PropertyType.Font);
        return viewmodelInstanceValue;
    };
    /**
     * method to access an artboard property instance belonging
     * to the view model instance or to a nested view model instance
     * @param path - path to the image property
     */
    ViewModelInstance.prototype.artboard = function (path) {
        var viewmodelInstanceValue = this.propertyFromPath(path, PropertyType.Artboard);
        return viewmodelInstanceValue;
    };
    /**
     * method to access a view model property instance belonging
     * to the view model instance or to a nested view model instance
     * @param path - path to the view model property
     */
    ViewModelInstance.prototype.viewModel = function (path) {
        var pathSegments = path.split("/");
        var parentViewModelInstance = pathSegments.length > 1
            ? this.viewModelFromPathSegments(pathSegments.slice(0, pathSegments.length - 1), 0)
            : this;
        if (parentViewModelInstance != null) {
            return parentViewModelInstance.internalViewModelInstance(pathSegments[pathSegments.length - 1]);
        }
        return null;
    };
    ViewModelInstance.prototype.internalReplaceViewModel = function (name, value) {
        var _a;
        if (value.runtimeInstance !== null) {
            var result = ((_a = this._runtimeInstance) === null || _a === void 0 ? void 0 : _a.replaceViewModel(name, value.runtimeInstance)) ||
                false;
            if (result) {
                value.internalIncrementReferenceCount();
                var oldInstance_1 = this.internalViewModelInstance(name);
                if (oldInstance_1 !== null) {
                    oldInstance_1.removeParent(this);
                    if (this._children.includes(oldInstance_1)) {
                        this._children = this._children.filter(function (child) { return child !== oldInstance_1; });
                    }
                    oldInstance_1.cleanup();
                }
                this._viewModelInstances.set(name, value);
                value.addParent(this);
            }
            return result;
        }
        return false;
    };
    /**
     * method to replace a view model property with another view model value
     * @param path - path to the view model property
     * @param value - view model that will replace the original
     */
    ViewModelInstance.prototype.replaceViewModel = function (path, value) {
        var _a;
        var pathSegments = path.split("/");
        var viewModelInstance = pathSegments.length > 1
            ? this.viewModelFromPathSegments(pathSegments.slice(0, pathSegments.length - 1), 0)
            : this;
        return ((_a = viewModelInstance === null || viewModelInstance === void 0 ? void 0 : viewModelInstance.internalReplaceViewModel(pathSegments[pathSegments.length - 1], value)) !== null && _a !== void 0 ? _a : false);
    };
    /*
     * method to add one to the reference counter of the instance.
     * Use if the file owning the reference is destroyed but the instance needs to stay around
     */
    ViewModelInstance.prototype.incrementReferenceCount = function () {
        var _a;
        this._referenceCount++;
        (_a = this._runtimeInstance) === null || _a === void 0 ? void 0 : _a.incrementReferenceCount();
    };
    /*
     * method to subtract one to the reference counter of the instance.
     * Use if incrementReferenceCount has been called
     */
    ViewModelInstance.prototype.decrementReferenceCount = function () {
        var _a;
        this._referenceCount--;
        (_a = this._runtimeInstance) === null || _a === void 0 ? void 0 : _a.decrementReferenceCount();
    };
    Object.defineProperty(ViewModelInstance.prototype, "properties", {
        get: function () {
            var _a;
            return (((_a = this._runtimeInstance) === null || _a === void 0 ? void 0 : _a.getProperties().map(function (prop) { return (__assign({}, prop)); })) || []);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ViewModelInstance.prototype, "viewModelName", {
        /**
         * Get the name of the ViewModel definition this instance was created from.
         */
        get: function () {
            var _a, _b;
            return (_b = (_a = this._runtimeInstance) === null || _a === void 0 ? void 0 : _a.getViewModelName()) !== null && _b !== void 0 ? _b : "";
        },
        enumerable: false,
        configurable: true
    });
    ViewModelInstance.prototype.internalIncrementReferenceCount = function () {
        this._referenceCount++;
    };
    ViewModelInstance.prototype.cleanup = function () {
        var _this = this;
        var _a;
        this._referenceCount--;
        if (this._referenceCount <= 0) {
            if (this.selfUnref) {
                (_a = this._runtimeInstance) === null || _a === void 0 ? void 0 : _a.unref();
            }
            this._runtimeInstance = null;
            this.clearCallbacks();
            this._propertiesWithCallbacks = [];
            this._viewModelInstances.forEach(function (value) {
                value.cleanup();
            });
            this._viewModelInstances.clear();
            var children = __spreadArray([], this._children, true);
            this._children.length = 0;
            var parents = __spreadArray([], this._parents, true);
            this._parents.length = 0;
            children.forEach(function (child) {
                child.removeParent(_this);
            });
            parents.forEach(function (parent) {
                parent.removeFromViewModelCallbacks(_this);
            });
        }
    };
    return ViewModelInstance;
}());

var ViewModelInstanceValue = /** @class */ (function () {
    function ViewModelInstanceValue(instance, parent) {
        this.callbacks = [];
        this._viewModelInstanceValue = instance;
        this._parentViewModel = parent;
    }
    ViewModelInstanceValue.prototype.on = function (callback) {
        // Since we don't clean the changed flag for properties that don't have listeners,
        // we clean it the first time we add a listener to it
        if (this.callbacks.length === 0) {
            this._viewModelInstanceValue.clearChanges();
        }
        if (!this.callbacks.includes(callback)) {
            this.callbacks.push(callback);
            this._parentViewModel.addToPropertyCallbacks(this);
        }
    };
    ViewModelInstanceValue.prototype.off = function (callback) {
        if (!callback) {
            this.callbacks.length = 0;
        }
        else {
            this.callbacks = this.callbacks.filter(function (cb) { return cb !== callback; });
        }
        if (this.callbacks.length === 0) {
            this._parentViewModel.removeFromPropertyCallbacks(this);
        }
    };
    ViewModelInstanceValue.prototype.internalHandleCallback = function (callback) { };
    ViewModelInstanceValue.prototype.handleCallbacks = function () {
        var _this = this;
        if (this._viewModelInstanceValue.hasChanged) {
            this.callbacks.forEach(function (callback) {
                _this.internalHandleCallback(callback);
            });
        }
    };
    ViewModelInstanceValue.prototype.clearChanges = function () {
        this._viewModelInstanceValue.clearChanges();
    };
    ViewModelInstanceValue.prototype.clearCallbacks = function () {
        this.callbacks.length = 0;
    };
    Object.defineProperty(ViewModelInstanceValue.prototype, "name", {
        get: function () {
            return this._viewModelInstanceValue.name;
        },
        enumerable: false,
        configurable: true
    });
    return ViewModelInstanceValue;
}());

var ViewModelInstanceString = /** @class */ (function (_super) {
    __extends(ViewModelInstanceString, _super);
    function ViewModelInstanceString(instance, parent) {
        return _super.call(this, instance, parent) || this;
    }
    Object.defineProperty(ViewModelInstanceString.prototype, "value", {
        get: function () {
            return this._viewModelInstanceValue.value;
        },
        set: function (val) {
            this._viewModelInstanceValue.value = val;
        },
        enumerable: false,
        configurable: true
    });
    ViewModelInstanceString.prototype.internalHandleCallback = function (callback) {
        callback(this.value);
    };
    return ViewModelInstanceString;
}(ViewModelInstanceValue));

var ViewModelInstanceNumber = /** @class */ (function (_super) {
    __extends(ViewModelInstanceNumber, _super);
    function ViewModelInstanceNumber(instance, parent) {
        return _super.call(this, instance, parent) || this;
    }
    Object.defineProperty(ViewModelInstanceNumber.prototype, "value", {
        get: function () {
            return this._viewModelInstanceValue.value;
        },
        set: function (val) {
            this._viewModelInstanceValue.value = val;
        },
        enumerable: false,
        configurable: true
    });
    ViewModelInstanceNumber.prototype.internalHandleCallback = function (callback) {
        callback(this.value);
    };
    return ViewModelInstanceNumber;
}(ViewModelInstanceValue));

var ViewModelInstanceBoolean = /** @class */ (function (_super) {
    __extends(ViewModelInstanceBoolean, _super);
    function ViewModelInstanceBoolean(instance, parent) {
        return _super.call(this, instance, parent) || this;
    }
    Object.defineProperty(ViewModelInstanceBoolean.prototype, "value", {
        get: function () {
            return this._viewModelInstanceValue.value;
        },
        set: function (val) {
            this._viewModelInstanceValue.value = val;
        },
        enumerable: false,
        configurable: true
    });
    ViewModelInstanceBoolean.prototype.internalHandleCallback = function (callback) {
        callback(this.value);
    };
    return ViewModelInstanceBoolean;
}(ViewModelInstanceValue));

var ViewModelInstanceTrigger = /** @class */ (function (_super) {
    __extends(ViewModelInstanceTrigger, _super);
    function ViewModelInstanceTrigger(instance, parent) {
        return _super.call(this, instance, parent) || this;
    }
    ViewModelInstanceTrigger.prototype.trigger = function () {
        return this._viewModelInstanceValue.trigger();
    };
    ViewModelInstanceTrigger.prototype.internalHandleCallback = function (callback) {
        callback();
    };
    return ViewModelInstanceTrigger;
}(ViewModelInstanceValue));

var ViewModelInstanceEnum = /** @class */ (function (_super) {
    __extends(ViewModelInstanceEnum, _super);
    function ViewModelInstanceEnum(instance, parent) {
        return _super.call(this, instance, parent) || this;
    }
    Object.defineProperty(ViewModelInstanceEnum.prototype, "value", {
        get: function () {
            return this._viewModelInstanceValue.value;
        },
        set: function (val) {
            this._viewModelInstanceValue.value = val;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ViewModelInstanceEnum.prototype, "valueIndex", {
        get: function () {
            return this._viewModelInstanceValue
                .valueIndex;
        },
        set: function (val) {
            this._viewModelInstanceValue.valueIndex = val;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ViewModelInstanceEnum.prototype, "values", {
        get: function () {
            return this._viewModelInstanceValue.values;
        },
        enumerable: false,
        configurable: true
    });
    ViewModelInstanceEnum.prototype.internalHandleCallback = function (callback) {
        callback(this.value);
    };
    return ViewModelInstanceEnum;
}(ViewModelInstanceValue));

var ViewModelInstanceList = /** @class */ (function (_super) {
    __extends(ViewModelInstanceList, _super);
    function ViewModelInstanceList(instance, parent) {
        return _super.call(this, instance, parent) || this;
    }
    Object.defineProperty(ViewModelInstanceList.prototype, "length", {
        get: function () {
            return this._viewModelInstanceValue.size;
        },
        enumerable: false,
        configurable: true
    });
    ViewModelInstanceList.prototype.addInstance = function (instance) {
        if (instance.runtimeInstance != null) {
            this._viewModelInstanceValue.addInstance(instance.runtimeInstance);
            instance.addParent(this._parentViewModel);
        }
    };
    ViewModelInstanceList.prototype.addInstanceAt = function (instance, index) {
        if (instance.runtimeInstance != null) {
            if (this._viewModelInstanceValue.addInstanceAt(instance.runtimeInstance, index)) {
                instance.addParent(this._parentViewModel);
                return true;
            }
        }
        return false;
    };
    ViewModelInstanceList.prototype.removeInstance = function (instance) {
        if (instance.runtimeInstance != null) {
            this._viewModelInstanceValue.removeInstance(instance.runtimeInstance);
            instance.removeParent(this._parentViewModel);
        }
    };
    ViewModelInstanceList.prototype.removeInstanceAt = function (index) {
        this._viewModelInstanceValue.removeInstanceAt(index);
    };
    ViewModelInstanceList.prototype.instanceAt = function (index) {
        var runtimeInstance = this._viewModelInstanceValue.instanceAt(index);
        if (runtimeInstance != null) {
            var viewModelInstance = new ViewModelInstance(runtimeInstance, this._parentViewModel);
            (0,_utils__WEBPACK_IMPORTED_MODULE_3__.createFinalization)(viewModelInstance, runtimeInstance);
            return viewModelInstance;
        }
        return null;
    };
    ViewModelInstanceList.prototype.swap = function (a, b) {
        this._viewModelInstanceValue.swap(a, b);
    };
    ViewModelInstanceList.prototype.internalHandleCallback = function (callback) {
        callback();
    };
    return ViewModelInstanceList;
}(ViewModelInstanceValue));

var ViewModelInstanceColor = /** @class */ (function (_super) {
    __extends(ViewModelInstanceColor, _super);
    function ViewModelInstanceColor(instance, parent) {
        return _super.call(this, instance, parent) || this;
    }
    Object.defineProperty(ViewModelInstanceColor.prototype, "value", {
        get: function () {
            return this._viewModelInstanceValue.value;
        },
        set: function (val) {
            this._viewModelInstanceValue.value = val;
        },
        enumerable: false,
        configurable: true
    });
    ViewModelInstanceColor.prototype.rgb = function (r, g, b) {
        this._viewModelInstanceValue.rgb(r, g, b);
    };
    ViewModelInstanceColor.prototype.rgba = function (r, g, b, a) {
        this._viewModelInstanceValue.argb(a, r, g, b);
    };
    ViewModelInstanceColor.prototype.argb = function (a, r, g, b) {
        this._viewModelInstanceValue.argb(a, r, g, b);
    };
    // Value 0 to 255
    ViewModelInstanceColor.prototype.alpha = function (a) {
        this._viewModelInstanceValue.alpha(a);
    };
    // Value 0 to 1
    ViewModelInstanceColor.prototype.opacity = function (o) {
        this._viewModelInstanceValue.alpha(Math.round(Math.max(0, Math.min(1, o)) * 255));
    };
    ViewModelInstanceColor.prototype.internalHandleCallback = function (callback) {
        callback(this.value);
    };
    return ViewModelInstanceColor;
}(ViewModelInstanceValue));

var ViewModelInstanceAssetImage = /** @class */ (function (_super) {
    __extends(ViewModelInstanceAssetImage, _super);
    function ViewModelInstanceAssetImage(instance, root) {
        return _super.call(this, instance, root) || this;
    }
    Object.defineProperty(ViewModelInstanceAssetImage.prototype, "value", {
        set: function (image) {
            var _a;
            this._viewModelInstanceValue.value((_a = image === null || image === void 0 ? void 0 : image.nativeImage) !== null && _a !== void 0 ? _a : null);
        },
        enumerable: false,
        configurable: true
    });
    ViewModelInstanceAssetImage.prototype.internalHandleCallback = function (callback) {
        callback();
    };
    return ViewModelInstanceAssetImage;
}(ViewModelInstanceValue));

var ViewModelInstanceAssetFont = /** @class */ (function (_super) {
    __extends(ViewModelInstanceAssetFont, _super);
    function ViewModelInstanceAssetFont(instance, root) {
        return _super.call(this, instance, root) || this;
    }
    Object.defineProperty(ViewModelInstanceAssetFont.prototype, "value", {
        set: function (font) {
            var _a;
            this._viewModelInstanceValue.value((_a = font === null || font === void 0 ? void 0 : font.nativeFont) !== null && _a !== void 0 ? _a : null);
        },
        enumerable: false,
        configurable: true
    });
    ViewModelInstanceAssetFont.prototype.internalHandleCallback = function (callback) {
        callback();
    };
    return ViewModelInstanceAssetFont;
}(ViewModelInstanceValue));

var ViewModelInstanceArtboard = /** @class */ (function (_super) {
    __extends(ViewModelInstanceArtboard, _super);
    function ViewModelInstanceArtboard(instance, root) {
        return _super.call(this, instance, root) || this;
    }
    Object.defineProperty(ViewModelInstanceArtboard.prototype, "value", {
        set: function (artboard) {
            var _a, _b;
            var bindableArtboard;
            if (artboard.isBindableArtboard) {
                bindableArtboard = artboard;
            }
            else {
                bindableArtboard = artboard.file.internalBindableArtboardFromArtboard(artboard.nativeArtboard);
            }
            this._viewModelInstanceValue.value((_a = bindableArtboard === null || bindableArtboard === void 0 ? void 0 : bindableArtboard.nativeArtboard) !== null && _a !== void 0 ? _a : null);
            if (bindableArtboard === null || bindableArtboard === void 0 ? void 0 : bindableArtboard.nativeViewModel) {
                this._viewModelInstanceValue.viewModelInstance((_b = bindableArtboard === null || bindableArtboard === void 0 ? void 0 : bindableArtboard.nativeViewModel) !== null && _b !== void 0 ? _b : null);
            }
        },
        enumerable: false,
        configurable: true
    });
    ViewModelInstanceArtboard.prototype.internalHandleCallback = function (callback) {
        callback();
    };
    return ViewModelInstanceArtboard;
}(ViewModelInstanceValue));

// Loads Rive data from a URI via fetch.
var loadRiveFile = function (src) { return __awaiter(void 0, void 0, void 0, function () {
    var req, res, buffer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                req = new Request(src);
                return [4 /*yield*/, fetch(req)];
            case 1:
                res = _a.sent();
                if (!res.ok) {
                    throw new Error("Failed to fetch the Rive file: HTTP ".concat(res.status));
                }
                return [4 /*yield*/, res.arrayBuffer()];
            case 2:
                buffer = _a.sent();
                return [2 /*return*/, buffer];
        }
    });
}); };
// #endregion
// #region utility functions
/*
 * Utility function to ensure an object is a string array
 */
var mapToStringArray = function (obj) {
    if (typeof obj === "string") {
        return [obj];
    }
    else if (obj instanceof Array) {
        return obj;
    }
    // If obj is undefined, return empty array
    return [];
};
// #endregion
// #region testing utilities
// Exports to only be used for tests
var Testing = {
    EventManager: EventManager,
    TaskQueueManager: TaskQueueManager,
};
// #endregion
// #region asset loaders
/**
 * Decodes bytes into an audio asset.
 *
 * Be sure to call `.unref()` on the audio once it is no longer needed. This
 * allows the engine to clean it up when it is not used by any more animations.
 */
var decodeAudio = function (bytes) { return __awaiter(void 0, void 0, void 0, function () {
    var decodedPromise, audio, audioWrapper;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                decodedPromise = new Promise(function (resolve) {
                    return _runtimeLoader__WEBPACK_IMPORTED_MODULE_1__.RuntimeLoader.getInstance(function (rive) {
                        rive.decodeAudio(bytes, resolve, null);
                    });
                });
                return [4 /*yield*/, decodedPromise];
            case 1:
                audio = _a.sent();
                audioWrapper = new _utils__WEBPACK_IMPORTED_MODULE_3__.AudioWrapper(audio);
                _utils__WEBPACK_IMPORTED_MODULE_3__.finalizationRegistry.register(audioWrapper, audio);
                return [2 /*return*/, audioWrapper];
        }
    });
}); };
/**
 * Decodes bytes into an image.
 *
 * Be sure to call `.unref()` on the image once it is no longer needed. This
 * allows the engine to clean it up when it is not used by any more animations.
 */
var decodeImage = function (bytes) { return __awaiter(void 0, void 0, void 0, function () {
    var decodedPromise, image, imageWrapper;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                decodedPromise = new Promise(function (resolve) {
                    return _runtimeLoader__WEBPACK_IMPORTED_MODULE_1__.RuntimeLoader.getInstance(function (rive) {
                        rive.decodeImage(bytes, resolve, null);
                    });
                });
                return [4 /*yield*/, decodedPromise];
            case 1:
                image = _a.sent();
                imageWrapper = new _utils__WEBPACK_IMPORTED_MODULE_3__.ImageWrapper(image);
                _utils__WEBPACK_IMPORTED_MODULE_3__.finalizationRegistry.register(imageWrapper, image);
                return [2 /*return*/, imageWrapper];
        }
    });
}); };
/**
 * Decodes bytes into a font.
 *
 * Be sure to call `.unref()` on the font once it is no longer needed. This
 * allows the engine to clean it up when it is not used by any more animations.
 */
var decodeFont = function (bytes) { return __awaiter(void 0, void 0, void 0, function () {
    var decodedPromise, font, fontWrapper;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                decodedPromise = new Promise(function (resolve) {
                    return _runtimeLoader__WEBPACK_IMPORTED_MODULE_1__.RuntimeLoader.getInstance(function (rive) {
                        rive.decodeFont(bytes, resolve, null);
                    });
                });
                return [4 /*yield*/, decodedPromise];
            case 1:
                font = _a.sent();
                fontWrapper = new _utils__WEBPACK_IMPORTED_MODULE_3__.FontWrapper(font);
                _utils__WEBPACK_IMPORTED_MODULE_3__.finalizationRegistry.register(fontWrapper, font);
                return [2 /*return*/, fontWrapper];
        }
    });
}); };
// #endregion

})();

/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=rive.js.map