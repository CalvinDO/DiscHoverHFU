var DiscHoverHFU;
(function (DiscHoverHFU) {
    window.addEventListener("click", onClickWindow);
    document.addEventListener("mousemove", onMouseMove);
    let buildings;
    let roomSelect;
    let roomSelectH;
    let roomSelectSection;
    let markers;
    let karteDisplay;
    let currentHoveredImage;
    let currentHoveredString;
    let xMarker;
    let yMarker;
    let tolerance = 65;
    let vanishBlocked;
    let map = L.map('mapDiv').setView([48.058796, 8.202135], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
        maxZoom: 19.4,
    }).addTo(map);
    loadBuildings("json/buildings.json");
    async function loadBuildings(_url) {
        let response = await fetch(_url);
        buildings = await response.json();
        generateMarkers(buildings);
        selectTags();
        setMarkerIDs();
        setTotalObjectDisplay();
    }
    function getBuildingObjects(_building) {
        let discoveredObjects = 0;
        let maxObjects = 0;
        for (let index = 0; index < buildings.length; index++) {
            let currentBuilding = buildings[index];
            if (currentBuilding.name == _building) {
                for (let roomIndex = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                    let currentRoom = currentBuilding.rooms[roomIndex];
                    maxObjects += currentRoom.clickRegions.length;
                    if (+localStorage.getItem(currentRoom.name)) {
                        discoveredObjects += +localStorage.getItem(currentRoom.name);
                        console.log(localStorage.getItem(currentRoom.name));
                    }
                }
            }
        }
        return "(" + discoveredObjects + " &#47; " + maxObjects + ")";
    }
    function setTotalObjectDisplay() {
        karteDisplay.innerHTML = "Karte " + getTotalObjects();
    }
    function getTotalObjects() {
        let totalObjectCount = 0;
        let totalDiscoveredObjects = 0;
        for (let index = 0; index < buildings.length; index++) {
            let currentBuilding = buildings[index];
            for (let roomIndex = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                let currentRoom = currentBuilding.rooms[roomIndex];
                totalObjectCount += currentRoom.clickRegions.length;
                totalDiscoveredObjects += +localStorage.getItem(currentRoom.name);
            }
        }
        return "(" + totalDiscoveredObjects + " &#47; " + totalObjectCount + ")";
    }
    function getDiscoveredObjectsInRoom(_triggeredRoom) {
        let discoveredObjects;
        let maxObjects;
        for (let index = 0; index < buildings.length; index++) {
            let currentBuilding = buildings[index];
            for (let roomIndex = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                let currentRoom = currentBuilding.rooms[roomIndex];
                if (currentRoom.name == _triggeredRoom) {
                    maxObjects = currentRoom.clickRegions.length;
                    discoveredObjects = +localStorage.getItem(_triggeredRoom);
                }
            }
        }
        return "(" + discoveredObjects + " &#47; " + maxObjects + ")";
    }
    function selectTags() {
        roomSelect = document.querySelector(".roomSelection");
        roomSelect.addEventListener("mouseenter", onSelectEnter);
        roomSelect.addEventListener("mouseleave", onSelectLeave);
        roomSelectH = document.querySelector(".roomSelection h2");
        roomSelectSection = document.querySelector(".roomSelection section");
        karteDisplay = document.querySelector(".map_header h1");
    }
    function setMarkerIDs() {
        markers = document.querySelectorAll(".leaflet-marker-icon.leaflet-zoom-animated.leaflet-interactive");
        for (let index = 0; index < markers.length; index++) {
            markers[index].setAttribute("id", "marker");
            markers[index].addEventListener("mouseenter", handleMouseEnterMarkerImage.bind(markers[index]));
            markers[index].addEventListener("mouseleave", handleMouseLeaveMarkerImage.bind(markers[index]));
            markers[index].addEventListener("click", handleClickMarkerImage.bind(markers[index]));
        }
    }
    function generateMarkers(_buildings) {
        for (let index = 0; index < _buildings.length; index++) {
            let currentBuilding = buildings[index];
            let marker = L.marker([currentBuilding.phi, currentBuilding.theta]).addTo(map);
            //marker.bindPopup("<b>" + currentBuilding.name).openPopup();
            marker.name = currentBuilding.name;
            marker.addEventListener("mouseover", handleMouseOverMarker.bind(marker));
        }
    }
    function onClickRoom(_event) {
        localStorage.setItem("currentBuilding", currentHoveredString);
        localStorage.setItem("currentRoom", this.name);
    }
    function handleClickMarkerImage(_event) {
    }
    function handleMouseLeaveMarkerImage(_event) {
        /*
        roomSelect.setAttribute("style", "display: none !important");
        roomSelectH.innerHTML = currentHovered;
        roomSelectSection.innerHTML = currentHovered;
        */
    }
    function onSelectEnter(_event) {
        vanishBlocked = true;
    }
    function onSelectLeave(_event) {
        vanishBlocked = false;
    }
    function vanishDisplaySection() {
        roomSelect.setAttribute("style", "display: none !important");
        roomSelectH.innerHTML = "";
        roomSelectSection.innerHTML = "";
    }
    function onMouseMove(_event) {
        checkMarkerDistance(_event.clientX, _event.clientY);
    }
    function checkMarkerDistance(_x, _y) {
        let xDiff = _x - xMarker;
        let yDiff = _y - yMarker;
        if (xDiff > tolerance || yDiff > tolerance) {
            if (!vanishBlocked) {
                vanishDisplaySection();
            }
        }
    }
    function handleMouseEnterMarkerImage(_event) {
        roomSelectH.innerHTML = "";
        roomSelectSection.innerHTML = "";
        xMarker = this.getBoundingClientRect().x + 50;
        yMarker = this.getBoundingClientRect().y + 20;
        roomSelect.setAttribute("style", "transform: translateX(" + xMarker + "px) translateY(" + yMarker + "px); display: inline-block !important");
        roomSelectH.innerHTML = currentHoveredString + "  " + getBuildingObjects(currentHoveredString);
        for (let index = 0; index < buildings.length; index++) {
            let currentBuilding = buildings[index];
            if (currentHoveredString == currentBuilding.name) {
                for (let roomIndex = 0; roomIndex < currentBuilding.rooms.length; roomIndex++) {
                    let currentRoom = currentBuilding.rooms[roomIndex];
                    let currentRoomName = currentRoom.name;
                    let roomAnchor = document.createElement("a");
                    roomAnchor.addEventListener("click", onClickRoom.bind(currentRoom));
                    roomAnchor.innerHTML = currentRoomName + "  " + getDiscoveredObjectsInRoom(currentRoomName) + "<br>";
                    roomAnchor.setAttribute("href", "DiscHoverHFU.html");
                    roomSelectSection.append(roomAnchor);
                }
            }
        }
    }
    function handleMouseOverMarker(_event) {
        currentHoveredString = this.name;
    }
    function onClickWindow(_event) {
    }
})(DiscHoverHFU || (DiscHoverHFU = {}));
//# sourceMappingURL=OpenStreetMap.js.map