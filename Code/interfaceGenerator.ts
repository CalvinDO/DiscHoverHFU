namespace DiscHoverHFU {
    window.addEventListener("load", init);

    interface Room {
        name: string;
        description: string;
        image: string;
        ambienceSound: string;
        clickRegions: ClickRegion[];
    }

    interface ClickRegion {
        name: string;
        description: string;
        sound: string;
        phi: number;
        theta: number;
        tolerance: number;
    }

    let rooms: Room[];

    function init(_event: Event): void {
        communicate("json/rooms.json");
    }
    async function communicate(_url: RequestInfo): Promise<void> {
        let response: Response = await fetch(_url);
        let categorysJSON: Room[] = <Room[]>await response.json();

        loadRooms(categorysJSON);
    }
    function loadRooms(_rooms: Room[]): void {
        rooms = [];
        for (let index: number = 0; index < _rooms.length; index++{
            rooms.push(_rooms[index]);
        }
    }
}