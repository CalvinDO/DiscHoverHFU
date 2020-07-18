import { Building } from "./Main";
import { Room } from "./Main";
import { ClickRegion } from "./Main";

namespace DiscHoverHFU {
    window.addEventListener("click", onClickWindow);
    document.addEventListener("mousemove", onMouseMove);

    let buildings: Building[];
    let roomSelect: HTMLDivElement;
    let roomSelectH: HTMLHeadingElement;
    let roomSelectSection: HTMLParagraphElement;
    let markers: NodeListOf<HTMLImageElement>;

    let karteDisplay: HTMLHeadingElement;

    let currentHoveredImage: HTMLImageElement;
    let currentHoveredString: string;

    let xMarker: number;
    let yMarker: number;
    let tolerance: number = 65;

    let vanishBlocked: boolean;

    let map = L.map('mapDiv').setView([48.058796, 8.202135], 16);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
        maxZoom: 19.4,
    }).addTo(map);

    loadBuildings("json/buildings.json");


    async function loadBuildings(_url: RequestInfo): Promise<void> {
        let response: Response = await fetch(_url);
        buildings = <Building[]>await response.json();
        generateMarkers(buildings);
        selectTags();
        setMarkerIDs();
        setTotalObjectDisplay();
    }

    function getBuildingObjects(_building: string): string {
        let discoveredObjects: number = 0;

        let maxObjects: number = 0;

        for (let index: number = 0; index < buildings.length; index++) {
            let currentBuilding: Building = buildings[index];
            if (currentBuilding.name == _building) {
                for (let roomIndex: number = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                    let currentRoom: Room = currentBuilding.rooms[roomIndex];
                    maxObjects += currentRoom.clickRegions.length;
                    if (+localStorage.getItem(currentRoom.name)) {
                        discoveredObjects += +localStorage.getItem(currentRoom.name);
                        console.log(localStorage.getItem(currentRoom.name))
                    }
                }
            }
        }
        return "(" + discoveredObjects + " &#47; " + maxObjects + ")";
    }
    function setTotalObjectDisplay(): void {
        karteDisplay.innerHTML = "Karte " + getTotalObjects();
    }
    function getTotalObjects(): string {
        let totalObjectCount: number = 0;
        let totalDiscoveredObjects: number = 0;
        for (let index: number = 0; index < buildings.length; index++) {
            let currentBuilding: Building = buildings[index];
            for (let roomIndex: number = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                let currentRoom: Room = currentBuilding.rooms[roomIndex];
                totalObjectCount += currentRoom.clickRegions.length
                totalDiscoveredObjects += +localStorage.getItem(currentRoom.name);
            }
        }

        return "(" + totalDiscoveredObjects + " &#47; " + totalObjectCount + ")";
    }
    function getDiscoveredObjectsInRoom(_triggeredRoom: string): string {
        let discoveredObjects: number;

        let maxObjects: number;

        for (let index: number = 0; index < buildings.length; index++) {
            let currentBuilding: Building = buildings[index];
            for (let roomIndex: number = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                let currentRoom: Room = currentBuilding.rooms[roomIndex];
                if (currentRoom.name == _triggeredRoom) {
                    maxObjects = currentRoom.clickRegions.length;
                    discoveredObjects = +localStorage.getItem(_triggeredRoom);
                }
            }
        }
        return "(" + discoveredObjects + " &#47; " + maxObjects + ")" ;
    }

    function selectTags(): void {
        roomSelect = <HTMLDivElement>document.querySelector(".roomSelection");
        roomSelect.addEventListener("mouseenter", onSelectEnter);
        roomSelect.addEventListener("mouseleave", onSelectLeave);
        roomSelectH = <HTMLHeadingElement>document.querySelector(".roomSelection h2");
        roomSelectSection = <HTMLParagraphElement>document.querySelector(".roomSelection section");

        karteDisplay = <HTMLHeadingElement>document.querySelector(".map_header h1");
    }

    function setMarkerIDs(): void {
        markers = <NodeListOf<HTMLImageElement>>document.querySelectorAll(".leaflet-marker-icon.leaflet-zoom-animated.leaflet-interactive");
        for (let index: number = 0; index < markers.length; index++) {
            markers[index].setAttribute("id", "marker");
            markers[index].addEventListener("mouseenter", handleMouseEnterMarkerImage.bind(markers[index]));
            markers[index].addEventListener("mouseleave", handleMouseLeaveMarkerImage.bind(markers[index]));
            markers[index].addEventListener("click", handleClickMarkerImage.bind(markers[index]));
        }
    }

    function generateMarkers(_buildings: Building[]): void {
        for (let index: number = 0; index < _buildings.length; index++) {
            let currentBuilding: Building = buildings[index];

            let marker = L.marker([currentBuilding.phi, currentBuilding.theta]).addTo(map);
            //marker.bindPopup("<b>" + currentBuilding.name).openPopup();
            marker.name = currentBuilding.name;
            marker.addEventListener("mouseover", handleMouseOverMarker.bind(marker));
        }
    }
    function onClickRoom(this: Room, _event: Event): void {
        localStorage.setItem("currentBuilding", currentHoveredString);
        localStorage.setItem("currentRoom", this.name);
    }
    function handleClickMarkerImage(this, _event: Event): void {
    }
    function handleMouseLeaveMarkerImage(this: HTMLImageElement, _event: Event): void {
        /*
        roomSelect.setAttribute("style", "display: none !important");
        roomSelectH.innerHTML = currentHovered;
        roomSelectSection.innerHTML = currentHovered;
        */
    }
    function onSelectEnter(_event: MouseEvent): void {
        vanishBlocked = true;
    }

    function onSelectLeave(_event: MouseEvent): void {
        vanishBlocked = false;
    }
    function vanishDisplaySection(): void {
        roomSelect.setAttribute("style", "display: none !important");
        roomSelectH.innerHTML = "";
        roomSelectSection.innerHTML = "";
    }
    function onMouseMove(_event: MouseEvent): void {
        checkMarkerDistance(_event.clientX, _event.clientY);
    }
    function checkMarkerDistance(_x: number, _y: number) {
        let xDiff: number = _x - xMarker;
        let yDiff: number = _y - yMarker;

        if (xDiff > tolerance || yDiff > tolerance) {
            if (!vanishBlocked) {
                vanishDisplaySection();
            }
        }
    }

    function handleMouseEnterMarkerImage(this: HTMLImageElement, _event: Event): void {
        roomSelectH.innerHTML = "";
        roomSelectSection.innerHTML = "";

        xMarker = this.getBoundingClientRect().x + 50;
        yMarker = this.getBoundingClientRect().y + 20;

        roomSelect.setAttribute("style", "transform: translateX(" + xMarker + "px) translateY(" + yMarker + "px); display: inline-block !important");
        roomSelectH.innerHTML = currentHoveredString + "  " + getBuildingObjects(currentHoveredString);

        for (let index: number = 0; index < buildings.length; index++) {
            let currentBuilding: Building = buildings[index];
            if (currentHoveredString == currentBuilding.name) {
                for (let roomIndex: number = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                    let currentRoom: Room = currentBuilding.rooms[roomIndex];
                    let currentRoomName: string = currentRoom.name;
                    let roomAnchor: HTMLAnchorElement = document.createElement("a");
                    roomAnchor.addEventListener("click", onClickRoom.bind(currentRoom));
                    roomAnchor.innerHTML = currentRoomName + "  " + getDiscoveredObjectsInRoom(currentRoomName) + "<br>";
                    roomAnchor.setAttribute("href", "DiscHoverHFU.html");
                    roomSelectSection.append(roomAnchor);
                }
            }
        }
    }
    function handleMouseOverMarker(this: HTMLImageElement, _event: Event): void {
        currentHoveredString = this.name;
    }

    function onClickWindow(_event: Event): void {
    }
}
