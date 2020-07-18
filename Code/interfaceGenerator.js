var DiscHoverHFU;
(function (DiscHoverHFU) {
    window.addEventListener("load", init);
    let rooms;
    function init(_event) {
        communicate("json/rooms.json");
    }
    async function communicate(_url) {
        let response = await fetch(_url);
        let categorysJSON = await response.json();
        loadRooms(categorysJSON);
    }
    function loadRooms(_rooms) {
        rooms = [];
        for (let index = 0; index < _rooms.length; index++) {
            rooms.push(_rooms[index]);
        }
    }
})(DiscHoverHFU || (DiscHoverHFU = {}));
//# sourceMappingURL=interfaceGenerator.js.map