import { WebXRButton } from "./js/util/webxr-button.js";
import { Scene, WebXRView } from "./js/render/scenes/scene.js";
import { Renderer, createWebGLContext } from "./js/render/core/renderer.js";
import { Gltf2Node } from "./js/render/nodes/gltf2.js";
import { SkyboxNode } from "./js/render/nodes/skybox.js";
import { InlineViewerHelper } from "./js/util/inline-viewer-helper.js";
import { QueryArgs } from "./js/util/query-args.js";

import Vector2D = Vector.Vector2D;
import Vector3D = Vector.Vector3D;
import Vector4D = Vector.Vector4D;
import Matrix4D = Matrix.Matrix4D;

import WebXRPolyfill from "./js/third-party/webxr-polyfill/build/webxr-polyfill.module.js";

import Buildings = DiscHoverHFU.Buildings;
import GameState = DiscHoverHFU.GameState;

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

let lastMouse: Vector2D = new Vector2D(0, 0);
let currentMouse: Vector2D = new Vector2D(0, 0);
let offset: Vector2D = new Vector2D(0, 0);

let descriptionDisplay: HTMLDivElement;
let descriptionH: HTMLHeadingElement;
let descriptionP: HTMLParagraphElement;

let continueButton: HTMLAnchorElement;

let canvas: HTMLCanvasElement;

let header: HTMLElement;
let crossAir: HTMLParagraphElement;

let crossAirOverRegion: boolean;

let pointerLocked: boolean = false;
let activeBuilding: string = "ABau";

let activeRoom: string = "Cafete";
let activeRoomURL: string;

//sounds
let mouseDownSound: HTMLAudioElement;
let mouseUpSound: HTMLAudioElement;

let gameState: GameState;

//off-Canvas animation
let perspectivePixel: number = 1500;
let goalAngle: number = 60;
let startAngle: number = 0;

let currentAngle: number = 0;
let accel: number = -0.04;
let treshhold: number = 0.2;

let goalBlur = 7;
let goalGrayscale = 30;
let goalSepia = 50;

let goalNavOffset = 100;
let startNavOffset = -210;

//completion status
let discoveredObjects: number;
let maxObjects: number;

let lastLocalStorageSet: string;

let completionDisplay: HTMLParagraphElement;

let soundToBePlayed: string;

let backgroundSound;
let sfxVolume: number = 0.15;
let backgroundVolume: number = 0.7;
let clickVolume: number = 0.4;

export interface Building {
    name: string;
    phi: number;
    theta: number;
    description: string;
    image: string;
    ambienceSound: string;
    rooms: Room[];
}
export interface Room {
    name: string;
    description: string;
    image: string;
    ambienceSound: string;
    clickRegions: ClickRegion[];
}
export interface ClickRegion {
    name: string;
    description: string;
    sound: string;
    phi: number;
    theta: number;
    tolerance: number;
}

export interface AudioContainer {
    name: string;
    audioString: string
}

let audios: AudioContainer[] = [];

let buildings: Building[];


function init(_event: Event): void {
    // Start the XR application.
    gameState = GameState.Started;

    document.body.addEventListener("click", onClickBody);
    document.body.addEventListener("mousedown", onMouseDown);
    document.body.addEventListener("mouseup", onMouseUp);

    //window.addEventListener("mousemove", onMouseMoveBody);
    loadLocalStorage();
    loadBuildings("json/buildings.json");
    initXR();
}
async function loadBuildings(_url: RequestInfo): Promise<void> {
    let response: Response = await fetch(_url);
    buildings = <Building[]>await response.json();
    checkRoomCompletion();
    loadSounds();
}
function loadLocalStorage(): void {
    if (localStorage.getItem("currentRoom")) {
        activeRoom = localStorage.getItem("currentRoom");
    } else {
        activeRoom = "Cafete";
    }
    if (localStorage.getItem("currentBuilding")) {
        activeBuilding = localStorage.getItem("currentBuilding");
    } else {
        activeBuilding = "ABau";
    }

    activeRoomURL = "media/textures/" + activeBuilding + "/" + activeRoom + ".jpg";
    scene.addNode(new SkyboxNode({
        url: activeRoomURL
    }));
}

function selectTags(): void {
    descriptionDisplay = <HTMLDivElement>document.querySelector("#descriptionDisplay");
    descriptionP = <HTMLParagraphElement>document.querySelector("#descriptionDisplay p");
    descriptionH = <HTMLParagraphElement>document.querySelector("#descriptionDisplay h2");
    crossAir = <HTMLParagraphElement>document.querySelector("#pointer");

    continueButton = <HTMLAnchorElement>document.querySelector("#start");
    continueButton.addEventListener("click", onContinue);

    completionDisplay = <HTMLParagraphElement>document.querySelector("#completionDisplay");

    canvas = <HTMLCanvasElement>document.querySelector("canvas");
    header = <HTMLElement>document.querySelector("header");


    mouseDownSound = new Audio("media/sound/MouseClicks/down.mp3");
    mouseDownSound.volume = clickVolume;
    mouseUpSound = new Audio("media/sound/MouseClicks/up.mp3");
    mouseUpSound.volume = clickVolume;
}
function onContinue(_event: Event): void {
    gameState = GameState.TransitionToGame;
}
function onClickBody(_event: MouseEvent): void {

}
function onMouseDown(_event: MouseEvent): void {
    mouseDownSound.play();
    if (!crossAirOverRegion) {
        crossAir.setAttribute("class", "fail-pointer");
    }
}
function onMouseUp(_event: MouseEvent): void {
    mouseUpSound.play();
    searchClicks();

}
function onKeyDown(_event: KeyboardEvent): void {
    if (_event.key == "e" || _event.key == "E" || _event.key == " " || _event.key == "p") {
        if (gameState == GameState.Paused || gameState == GameState.TransitionToMenu) {
            canvas.setAttribute("class", "running");
            gameState = GameState.TransitionToGame;
        } else if (gameState == GameState.Running || gameState == GameState.TransitionToGame) {
            canvas.setAttribute("class", "paused");
            gameState = GameState.TransitionToMenu;
        }
    }
}
function searchClicks(): void {
    try {
        crossAirOverRegion = false;
        checkClickLocation(getUsefulYaw(inlineViewerHelper.lookYaw), getUsefulPitch(inlineViewerHelper.lookPitch));
    } catch (error) {
        crossAirOverRegion = true;
        localStorage.setItem(descriptionH.innerHTML, "discovered");
        playClickRegionSound();
        checkRoomCompletion();
    }
    if (!crossAirOverRegion) {
        crossAir.setAttribute("class", "normal-pointer");
    } else {
        crossAir.setAttribute("class", "success-pointer");
    }


}
function getUsefulYaw(_yaw: number): number {
    let output: number = ((_yaw / Math.PI) * 180) % 360;
    output += output < 0 ? 360 : 0;
    return output;
}
function getUsefulPitch(_pitch: number): number {
    return (_pitch / Math.PI) * 180;
}
function playBackgroundSound(): void {
    if (backgroundSound) {
        backgroundSound.play();
    }
}
function loadSounds(): void {
    for (let index: number = 0; index < buildings.length; index++) {
        let currentBuilding: Building = buildings[index];
        if (currentBuilding.name == activeBuilding) {
            for (let roomIndex: number = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                let currentRoom: Room = currentBuilding.rooms[roomIndex];

                if (currentRoom.name == activeRoom) {
                    backgroundSound = new Audio("media/sound/" + activeBuilding + "/" + activeRoom + "/" + currentRoom.ambienceSound);
                    backgroundSound.volume = backgroundVolume;
                    for (let regionIndex: number = 0; regionIndex < currentRoom.clickRegions.length; regionIndex++) {
                        let currentClickRegion: ClickRegion = currentRoom.clickRegions[regionIndex];

                        let newAudioString: string = "media/sound/" + activeBuilding + "/" + activeRoom + "/" + currentClickRegion.sound;
                        let newAudioSingle = new Audio(newAudioString);

                        let newAudio: AudioContainer = {
                            name: currentClickRegion.name,
                            audioString: newAudioString
                        }
                        audios.push(newAudio);
                    }
                }
            }
        }
    }
}
function checkRoomCompletion() {
    for (let index: number = 0; index < buildings.length; index++) {
        let currentBuilding: Building = buildings[index];
        if (currentBuilding.name == activeBuilding) {
            for (let roomIndex: number = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                let currentRoom: Room = currentBuilding.rooms[roomIndex];
                if (currentRoom.name == activeRoom) {
                    maxObjects = currentRoom.clickRegions.length;
                }
            }
        }
    }

    discoveredObjects = 0;
    for (let index: number = 0; index < localStorage.length; index++) {
        let key: string = <string>localStorage.key(index);
        if (localStorage.getItem(key) == "discovered") {
            for (let index: number = 0; index < buildings.length; index++) {
                let currentBuilding: Building = buildings[index];
                if (currentBuilding.name == activeBuilding) {
                    for (let roomIndex: number = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                        let currentRoom: Room = currentBuilding.rooms[roomIndex];
                        if (currentRoom.name == activeRoom) {
                            for (let regionIndex: number = 0; regionIndex < currentRoom.clickRegions.length; regionIndex++) {
                                let currentClickRegion: ClickRegion = currentRoom.clickRegions[regionIndex];
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

function checkClickLocation(_yaw: number, _pitch: number): void {
    for (let index: number = 0; index < buildings.length; index++) {
        let currentBuilding: Building = buildings[index];
        if (currentBuilding.name == activeBuilding) {
            for (let roomIndex: number = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                let currentRoom: Room = currentBuilding.rooms[roomIndex];
                if (currentRoom.name == activeRoom) {
                    for (let regionIndex: number = 0; regionIndex < currentRoom.clickRegions.length; regionIndex++) {
                        let currentClickRegion: ClickRegion = currentRoom.clickRegions[regionIndex];

                        let destVector: Vector2D = new Vector2D(currentClickRegion.phi, currentClickRegion.theta);
                        let currentVector: Vector2D = new Vector2D(_yaw, _pitch);

                        let distance: number = destVector.getDistanceTo(currentVector);

                        if (distance < currentClickRegion.tolerance) {
                            descriptionDisplay.setAttribute("class", "visible");
                            descriptionH.innerHTML = currentClickRegion.name;
                            descriptionP.innerHTML = currentClickRegion.description;
                            throw new Error();
                        } else {
                            descriptionDisplay.setAttribute("class", "invisible");
                        }
                    }
                }
            }
        }
    }
}
function playClickRegionSound(): void {
    for (let index: number = 0; index < audios.length; index++) {
        if (audios[index].name.toString() == descriptionH.innerHTML) {
            let audio = new Audio(audios[index].audioString);
            audio.volume = sfxVolume;
            audio.play();
        }
    }

}

function setPointerLock(): void {
    gl.canvas.requestPointerLock = gl.canvas.requestPointerLock || gl.canvas.mozRequestPointerLock;
    gl.canvas.requestPointerLock();
}

function exitPointerLock(): void {
    document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
    document.exitPointerLock();
}
function animateOffCanvas(): void {
    if (gameState == GameState.TransitionToMenu) {
        let distance: number = goalAngle - currentAngle;
        let addition: number = distance * accel;
        currentAngle -= addition;
        if (distance < treshhold) {
            gameState = GameState.Paused;
            currentAngle = goalAngle;
        }
    }
    if (gameState == GameState.TransitionToGame) {
        let distance: number = currentAngle;
        let addition: number = distance * -accel;
        currentAngle -= addition;
        if (distance < treshhold) {
            gameState = GameState.Running;
            currentAngle = startAngle;
        }
    }

    let factor: number = currentAngle / goalAngle;
    let currentBlur: number = goalBlur * factor;
    let currentGrayscale: number = goalGrayscale * factor;
    let currentSepia: number = goalSepia * factor;

    let currentNavOffset: number = startNavOffset + factor * (goalNavOffset - startNavOffset);
    header.setAttribute("style", "left: " + currentNavOffset + "px");
    canvas.setAttribute("style", "transform: perspective(" + perspectivePixel + "px) rotateY(" + (-currentAngle) + "deg); filter: blur(" + currentBlur + "px) grayscale(" + currentGrayscale + "%) sepia(" + currentSepia + "%)");
}

function onMouseMoveBody(_event: MouseEvent): void {
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
        } else {
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
    } else {
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
