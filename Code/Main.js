import { Scene, WebXRView } from "./js/render/scenes/scene.js";
import { Renderer, createWebGLContext } from "./js/render/core/renderer.js";
import { SkyboxNode } from "./js/render/nodes/skybox.js";
import { InlineViewerHelper } from "./js/util/inline-viewer-helper.js";
import { QueryArgs } from "./js/util/query-args.js";
var Vector2D = Vector.Vector2D;
import WebXRPolyfill from "./js/third-party/webxr-polyfill/build/webxr-polyfill.module.js";
var GameState = DiscHoverHFU.GameState;
window.addEventListener("load", init);
document.addEventListener("keydown", onKeyDown);
// If requested, use the polyfill to provide support for mobile devices
// and devices which only support WebVR.
if (QueryArgs.getBool("usePolyfill", true)) {
    let polyfill = new WebXRPolyfill();
}
// XR globals.
//let xrButton = null;
let xrImmersiveRefSpace = null;
let inlineViewerHelper = null;
// WebGL scene globals.
let gl = null;
let renderer = null;
let scene = new Scene();
let renderView = null;
let lastMouse = new Vector2D(0, 0);
let currentMouse = new Vector2D(0, 0);
let offset = new Vector2D(0, 0);
let descriptionDisplay;
let descriptionH;
let descriptionP;
let continueButton;
let canvas;
let header;
let crossAir;
let crossAirOverRegion;
let pointerLocked = false;
let activeBuilding = "ABau";
let activeRoom = "Cafete";
let activeRoomURL;
//sounds
let mouseDownSound;
let mouseUpSound;
let gameState;
//off-Canvas animation
let perspectivePixel = 1500;
let goalAngle = 60;
let startAngle = 0;
let currentAngle = 0;
let accel = -0.04;
let treshhold = 0.2;
let goalBlur = 7;
let goalGrayscale = 30;
let goalSepia = 50;
let goalNavOffset = 100;
let startNavOffset = -210;
//completion status
let discoveredObjects;
let maxObjects;
let lastLocalStorageSet;
let completionDisplay;
let soundToBePlayed;
let backgroundSound;
let sfxVolume = 0.15;
let backgroundVolume = 0.7;
let clickVolume = 0.4;
let audios = [];
let buildings;
function init(_event) {
    // Start the XR application.
    gameState = GameState.Started;
    document.body.addEventListener("click", onClickBody);
    document.body.addEventListener("mousedown", onMouseDown);
    document.body.addEventListener("mouseup", onMouseUp);
    //window.addEventListener("mousemove", onMouseMoveBody);
    loadBuildings("json/buildings.json");
    loadLocalStorage();
    initXR();
}
async function loadBuildings(_url) {
    let response = await fetch(_url);
    buildings = await response.json();
    checkRoomCompletion();
    loadSounds();
}
function loadLocalStorage() {
    if (localStorage.getItem("currentRoom")) {
        activeRoom = localStorage.getItem("currentRoom");
    }
    else {
        activeRoom = "Cafete";
    }
    if (localStorage.getItem("currentBuilding")) {
        activeBuilding = localStorage.getItem("currentBuilding");
    }
    else {
        activeBuilding = "ABau";
    }
    activeRoomURL = "media/textures/" + activeBuilding + "/" + activeRoom + ".jpg";
    scene.addNode(new SkyboxNode({
        url: activeRoomURL
    }));
}
function selectTags() {
    descriptionDisplay = document.querySelector("#descriptionDisplay");
    descriptionP = document.querySelector("#descriptionDisplay p");
    descriptionH = document.querySelector("#descriptionDisplay h2");
    crossAir = document.querySelector("#pointer");
    continueButton = document.querySelector("#start");
    continueButton.addEventListener("click", onContinue);
    completionDisplay = document.querySelector("#completionDisplay");
    canvas = document.querySelector("canvas");
    header = document.querySelector("header");
    mouseDownSound = new Audio("media/sound/MouseClicks/down.mp3");
    mouseDownSound.volume = clickVolume;
    mouseUpSound = new Audio("media/sound/MouseClicks/up.mp3");
    mouseUpSound.volume = clickVolume;
}
function onContinue(_event) {
    gameState = GameState.TransitionToGame;
}
function onClickBody(_event) {
}
function onMouseDown(_event) {
    mouseDownSound.play();
    if (!crossAirOverRegion) {
        crossAir.setAttribute("class", "fail-pointer");
    }
}
function onMouseUp(_event) {
    mouseUpSound.play();
    searchClicks();
}
function onKeyDown(_event) {
    if (_event.key == "e" || _event.key == "E" || _event.key == " " || _event.key == "p") {
        if (gameState == GameState.Paused || gameState == GameState.TransitionToMenu) {
            canvas.setAttribute("class", "running");
            gameState = GameState.TransitionToGame;
        }
        else if (gameState == GameState.Running || gameState == GameState.TransitionToGame) {
            canvas.setAttribute("class", "paused");
            gameState = GameState.TransitionToMenu;
        }
    }
}
function searchClicks() {
    try {
        crossAirOverRegion = false;
        checkClickLocation(getUsefulYaw(inlineViewerHelper.lookYaw), getUsefulPitch(inlineViewerHelper.lookPitch));
    }
    catch (error) {
        crossAirOverRegion = true;
        localStorage.setItem(descriptionH.innerHTML, "discovered");
        playClickRegionSound();
        checkRoomCompletion();
    }
    if (!crossAirOverRegion) {
        crossAir.setAttribute("class", "normal-pointer");
    }
    else {
        crossAir.setAttribute("class", "success-pointer");
    }
}
function getUsefulYaw(_yaw) {
    let output = ((_yaw / Math.PI) * 180) % 360;
    output += output < 0 ? 360 : 0;
    return output;
}
function getUsefulPitch(_pitch) {
    return (_pitch / Math.PI) * 180;
}
function playBackgroundSound() {
    if (backgroundSound) {
        backgroundSound.play();
    }
}
function loadSounds() {
    for (let index = 0; index < buildings.length; index++) {
        let currentBuilding = buildings[index];
        if (currentBuilding.name == activeBuilding) {
            for (let roomIndex = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                let currentRoom = currentBuilding.rooms[roomIndex];
                if (currentRoom.name == activeRoom) {
                    backgroundSound = new Audio("media/sound/" + activeBuilding + "/" + activeRoom + "/" + currentRoom.ambienceSound);
                    backgroundSound.volume = backgroundVolume;
                    for (let regionIndex = 0; regionIndex < currentRoom.clickRegions.length; regionIndex++) {
                        let currentClickRegion = currentRoom.clickRegions[regionIndex];
                        let newAudioString = "media/sound/" + activeBuilding + "/" + activeRoom + "/" + currentClickRegion.sound;
                        let newAudioSingle = new Audio(newAudioString);
                        let newAudio = {
                            name: currentClickRegion.name,
                            audioString: newAudioString
                        };
                        audios.push(newAudio);
                    }
                }
            }
        }
    }
}
function checkRoomCompletion() {
    for (let index = 0; index < buildings.length; index++) {
        let currentBuilding = buildings[index];
        if (currentBuilding.name == activeBuilding) {
            for (let roomIndex = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                let currentRoom = currentBuilding.rooms[roomIndex];
                if (currentRoom.name == activeRoom) {
                    maxObjects = currentRoom.clickRegions.length;
                }
            }
        }
    }
    discoveredObjects = 0;
    for (let index = 0; index < localStorage.length; index++) {
        let key = localStorage.key(index);
        if (localStorage.getItem(key) == "discovered") {
            for (let index = 0; index < buildings.length; index++) {
                let currentBuilding = buildings[index];
                if (currentBuilding.name == activeBuilding) {
                    for (let roomIndex = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                        let currentRoom = currentBuilding.rooms[roomIndex];
                        if (currentRoom.name == activeRoom) {
                            for (let regionIndex = 0; regionIndex < currentRoom.clickRegions.length; regionIndex++) {
                                let currentClickRegion = currentRoom.clickRegions[regionIndex];
                                if (currentClickRegion.name == key) {
                                    discoveredObjects++;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    localStorage.setItem(activeRoom, "" + discoveredObjects);
    completionDisplay.innerHTML = discoveredObjects + " &#47; " + maxObjects + "";
}
function checkClickLocation(_yaw, _pitch) {
    for (let index = 0; index < buildings.length; index++) {
        let currentBuilding = buildings[index];
        if (currentBuilding.name == activeBuilding) {
            for (let roomIndex = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                let currentRoom = currentBuilding.rooms[roomIndex];
                if (currentRoom.name == activeRoom) {
                    for (let regionIndex = 0; regionIndex < currentRoom.clickRegions.length; regionIndex++) {
                        let currentClickRegion = currentRoom.clickRegions[regionIndex];
                        let destVector = new Vector2D(currentClickRegion.phi, currentClickRegion.theta);
                        let currentVector = new Vector2D(_yaw, _pitch);
                        let distance = destVector.getDistanceTo(currentVector);
                        if (distance < currentClickRegion.tolerance) {
                            descriptionDisplay.setAttribute("class", "visible");
                            descriptionH.innerHTML = currentClickRegion.name;
                            descriptionP.innerHTML = currentClickRegion.description;
                            throw new Error();
                        }
                        else {
                            descriptionDisplay.setAttribute("class", "invisible");
                        }
                    }
                }
            }
        }
    }
}
function playClickRegionSound() {
    for (let index = 0; index < audios.length; index++) {
        if (audios[index].name.toString() == descriptionH.innerHTML) {
            let audio = new Audio(audios[index].audioString);
            audio.volume = sfxVolume;
            audio.play();
        }
    }
}
function setPointerLock() {
    gl.canvas.requestPointerLock = gl.canvas.requestPointerLock || gl.canvas.mozRequestPointerLock;
    gl.canvas.requestPointerLock();
}
function exitPointerLock() {
    document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
    document.exitPointerLock();
}
function animateOffCanvas() {
    if (gameState == GameState.TransitionToMenu) {
        let distance = goalAngle - currentAngle;
        let addition = distance * accel;
        currentAngle -= addition;
        if (distance < treshhold) {
            gameState = GameState.Paused;
            currentAngle = goalAngle;
        }
    }
    if (gameState == GameState.TransitionToGame) {
        let distance = currentAngle;
        let addition = distance * -accel;
        currentAngle -= addition;
        if (distance < treshhold) {
            gameState = GameState.Running;
            currentAngle = startAngle;
        }
    }
    let factor = currentAngle / goalAngle;
    let currentBlur = goalBlur * factor;
    let currentGrayscale = goalGrayscale * factor;
    let currentSepia = goalSepia * factor;
    let currentNavOffset = startNavOffset + factor * (goalNavOffset - startNavOffset);
    header.setAttribute("style", "left: " + currentNavOffset + "px");
    canvas.setAttribute("style", "transform: perspective(" + perspectivePixel + "px) rotateY(" + (-currentAngle) + "deg); filter: blur(" + currentBlur + "px) grayscale(" + currentGrayscale + "%) sepia(" + currentSepia + "%)");
}
function onMouseMoveBody(_event) {
    /*
   //console.log(canvas);
   
    let canvas: HTMLCanvasElement = document.querySelector("canvas");
    canvas.click();

    //console.log("move");

    let xMouseOffset: number = _event.clientX - canvas.width / 4;
    let yMouseOffset: number = _event.clientY - canvas.height / 4;

    let mouseOffset: Vector2D = new Vector2D(xMouseOffset, yMouseOffset);
    console.log("x: " + _event.clientX + " - " + canvas.width / 4 + " ergibt: " + xMouseOffset);
    console.log("y: " + _event.clientY + " - " + canvas.height / 4 + " ergibt: " + yMouseOffset);


    currentMouse = new Vector2D(_event.clientX, _event.clientY);
    offset = new Vector2D(currentMouse.x - lastMouse.x, currentMouse.y - lastMouse.y);
    console.log(offset);

    let influence: Vector2D = new Vector2D(offset.x / 100, offset.y / 100);

    inlineViewerHelper.lookYaw += influence.x;
    inlineViewerHelper.lookPitch += influence.y;

    lastMouse = currentMouse;

    //inlineViewerHelper.lookYaw = _event.clientX;
    //inlineViewerHelper.lookPitch = _event.clientY;

    */
}
function initXR() {
    /*
    xrButton = new WebXRButton({
        onRequestSession: onRequestSession,
        onEndSession: onEndSession
    });
    */
    //document.querySelector("header").appendChild(xrButton.domElement);
    if (navigator.xr) {
        navigator.xr.isSessionSupported("immersive-vr").then((supported) => {
            //xrButton.enabled = supported;
        });
        navigator.xr.requestSession("inline").then(onSessionStarted);
    }
}
function initGL() {
    if (gl)
        return;
    gl = createWebGLContext({
        xrCompatible: true
    });
    document.body.appendChild(gl.canvas);
    function onResize() {
        gl.canvas.width = gl.canvas.clientWidth * window.devicePixelRatio;
        gl.canvas.height = gl.canvas.clientHeight * window.devicePixelRatio;
    }
    window.addEventListener("resize", onResize);
    onResize();
    renderer = new Renderer(gl);
    scene.setRenderer(renderer);
}
function onRequestSession() {
    return navigator.xr.requestSession("immersive-vr").then((session) => {
        // xrButton.setSession(session);
        session.isImmersive = true;
        onSessionStarted(session);
    });
}
function onSessionStarted(session) {
    session.addEventListener("end", onSessionEnded);
    initGL();
    scene.inputRenderer.useProfileControllerMeshes(session);
    let glLayer = new XRWebGLLayer(session, gl);
    session.updateRenderState({ baseLayer: glLayer });
    // When rendering 360 photos/videos you want to ensure that the user"s
    // head is always at the center of the rendered media. Otherwise users
    // with 6DoF hardware could walk towards the edges and see a very skewed
    // or outright broken view of the image. To prevent that, we request a
    // "position-disabled" reference space, which suppresses any positional
    // information from the headset. (As an added bonus this mode may be
    // more power efficient on some hardware!)
    let refSpaceType = session.isImmersive ? "local" : "viewer";
    session.requestReferenceSpace(refSpaceType).then((refSpace) => {
        if (session.isImmersive) {
            xrImmersiveRefSpace = refSpace;
        }
        else {
            inlineViewerHelper = new InlineViewerHelper(gl.canvas, refSpace);
        }
        session.requestAnimationFrame(onXRFrame);
    });
    gameState = GameState.Running;
    selectTags();
}
function onEndSession(session) {
    session.end();
}
function onSessionEnded(event) {
    if (event.session.isImmersive) {
        // xrButton.setSession(null);
    }
}
function onXRFrame(t, frame) {
    scene.endFrame();
    animateOffCanvas();
    playBackgroundSound();
    switch (gameState) {
        case GameState.Started:
            break;
        case GameState.Paused:
            crossAir.setAttribute("class", "paused-pointer");
            completionDisplay.setAttribute("style", "display: inline-block !important");
            pointerLocked = false;
            break;
        case GameState.TransitionToGame:
            crossAir.setAttribute("class", "transition-pointer");
            pointerLocked = false;
            completionDisplay.setAttribute("style", "display: inline-block !important");
            break;
        case GameState.TransitionToMenu:
            crossAir.setAttribute("class", "transition-pointer");
            pointerLocked = false;
            completionDisplay.setAttribute("style", "display: inline-block !important");
            break;
        case GameState.Running:
            pointerLocked = true;
            completionDisplay.setAttribute("style", "display:none !important");
            break;
    }
    if (pointerLocked) {
        setPointerLock();
    }
    else {
        exitPointerLock();
    }
    let session = frame.session;
    let refSpace = session.isImmersive ?
        xrImmersiveRefSpace :
        inlineViewerHelper.referenceSpace;
    let pose = frame.getViewerPose(refSpace);
    scene.startFrame();
    session.requestAnimationFrame(onXRFrame);
    let glLayer = session.renderState.baseLayer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (pose) {
        let views = [];
        for (let view of pose.views) {
            renderView = new WebXRView(view, glLayer);
            // It"s important to take into account which eye the view is
            // associated with in cases like this, since it informs which half
            // of the stereo image should be used when rendering the view.
            //renderView.eye = view.eye
            views.push(renderView);
        }
        scene.updateInputSources(frame, refSpace);
        scene.drawViewArray(views);
    }
}
//# sourceMappingURL=Main.js.map