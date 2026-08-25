import type { PropertyId } from '@packages/engine-core';

export type SpaceType = 'PROPERTY' | 'GO' | 'JAIL' | 'FREE_PARKING' | 'GO_TO_JAIL' | 'TAX' | 'CHANCE' | 'CHEST';

export interface IBoardSpace {
  id: PropertyId;
  name: string;
  type: SpaceType;
  price?: number;
  baseRent?: number;
  colorGroup?: string;
  housePrice?: number;
  rentWithHouses?: number[];
}

export const BOARD_SPACES: IBoardSpace[] = [
  { id: 'go' as PropertyId, name: 'GO', type: 'GO' },
  { id: 'mediterranean' as PropertyId, name: 'Mediterranean Avenue', type: 'PROPERTY', price: 60, baseRent: 2, colorGroup: 'Brown', housePrice: 50, rentWithHouses: [10, 30, 90, 160, 250] },
  { id: 'chest1' as PropertyId, name: 'Community Chest', type: 'CHEST' },
  { id: 'baltic' as PropertyId, name: 'Baltic Avenue', type: 'PROPERTY', price: 60, baseRent: 4, colorGroup: 'Brown', housePrice: 50, rentWithHouses: [20, 60, 180, 320, 450] },
  { id: 'tax1' as PropertyId, name: 'Income Tax', type: 'TAX' },
  { id: 'reading' as PropertyId, name: 'Reading Railroad', type: 'PROPERTY', price: 200, baseRent: 25, colorGroup: 'Railroad' },
  { id: 'oriental' as PropertyId, name: 'Oriental Avenue', type: 'PROPERTY', price: 100, baseRent: 6, colorGroup: 'LightBlue', housePrice: 50, rentWithHouses: [30, 90, 270, 400, 550] },
  { id: 'chance1' as PropertyId, name: 'Chance', type: 'CHANCE' },
  { id: 'vermont' as PropertyId, name: 'Vermont Avenue', type: 'PROPERTY', price: 100, baseRent: 6, colorGroup: 'LightBlue', housePrice: 50, rentWithHouses: [30, 90, 270, 400, 550] },
  { id: 'connecticut' as PropertyId, name: 'Connecticut Avenue', type: 'PROPERTY', price: 120, baseRent: 8, colorGroup: 'LightBlue', housePrice: 50, rentWithHouses: [40, 100, 300, 450, 600] },
  { id: 'jail' as PropertyId, name: 'Jail', type: 'JAIL' },
  { id: 'st_charles' as PropertyId, name: 'St. Charles Place', type: 'PROPERTY', price: 140, baseRent: 10, colorGroup: 'Pink', housePrice: 100, rentWithHouses: [50, 150, 450, 625, 750] },
  { id: 'electric' as PropertyId, name: 'Electric Company', type: 'PROPERTY', price: 150, baseRent: 0, colorGroup: 'Utility' },
  { id: 'states' as PropertyId, name: 'States Avenue', type: 'PROPERTY', price: 140, baseRent: 10, colorGroup: 'Pink', housePrice: 100, rentWithHouses: [50, 150, 450, 625, 750] },
  { id: 'virginia' as PropertyId, name: 'Virginia Avenue', type: 'PROPERTY', price: 160, baseRent: 12, colorGroup: 'Pink', housePrice: 100, rentWithHouses: [60, 180, 500, 700, 900] },
  { id: 'penn_rr' as PropertyId, name: 'Pennsylvania Railroad', type: 'PROPERTY', price: 200, baseRent: 25, colorGroup: 'Railroad' },
  { id: 'st_james' as PropertyId, name: 'St. James Place', type: 'PROPERTY', price: 180, baseRent: 14, colorGroup: 'Orange', housePrice: 100, rentWithHouses: [70, 200, 550, 750, 950] },
  { id: 'chest2' as PropertyId, name: 'Community Chest', type: 'CHEST' },
  { id: 'tennessee' as PropertyId, name: 'Tennessee Avenue', type: 'PROPERTY', price: 180, baseRent: 14, colorGroup: 'Orange', housePrice: 100, rentWithHouses: [70, 200, 550, 750, 950] },
  { id: 'new_york' as PropertyId, name: 'New York Avenue', type: 'PROPERTY', price: 200, baseRent: 16, colorGroup: 'Orange', housePrice: 100, rentWithHouses: [80, 220, 600, 800, 1000] },
  { id: 'free_parking' as PropertyId, name: 'Free Parking', type: 'FREE_PARKING' },
  { id: 'kentucky' as PropertyId, name: 'Kentucky Avenue', type: 'PROPERTY', price: 220, baseRent: 18, colorGroup: 'Red', housePrice: 150, rentWithHouses: [90, 250, 700, 875, 1050] },
  { id: 'chance2' as PropertyId, name: 'Chance', type: 'CHANCE' },
  { id: 'indiana' as PropertyId, name: 'Indiana Avenue', type: 'PROPERTY', price: 220, baseRent: 18, colorGroup: 'Red', housePrice: 150, rentWithHouses: [90, 250, 700, 875, 1050] },
  { id: 'illinois' as PropertyId, name: 'Illinois Avenue', type: 'PROPERTY', price: 240, baseRent: 20, colorGroup: 'Red', housePrice: 150, rentWithHouses: [100, 300, 750, 925, 1100] },
  { id: 'bo_rr' as PropertyId, name: 'B. & O. Railroad', type: 'PROPERTY', price: 200, baseRent: 25, colorGroup: 'Railroad' },
  { id: 'atlantic' as PropertyId, name: 'Atlantic Avenue', type: 'PROPERTY', price: 260, baseRent: 22, colorGroup: 'Yellow', housePrice: 150, rentWithHouses: [110, 330, 800, 975, 1150] },
  { id: 'ventnor' as PropertyId, name: 'Ventnor Avenue', type: 'PROPERTY', price: 260, baseRent: 22, colorGroup: 'Yellow', housePrice: 150, rentWithHouses: [110, 330, 800, 975, 1150] },
  { id: 'water' as PropertyId, name: 'Water Works', type: 'PROPERTY', price: 150, baseRent: 0, colorGroup: 'Utility' },
  { id: 'marvin' as PropertyId, name: 'Marvin Gardens', type: 'PROPERTY', price: 280, baseRent: 24, colorGroup: 'Yellow', housePrice: 150, rentWithHouses: [120, 360, 850, 1025, 1200] },
  { id: 'go_to_jail' as PropertyId, name: 'Go To Jail', type: 'GO_TO_JAIL' },
  { id: 'pacific' as PropertyId, name: 'Pacific Avenue', type: 'PROPERTY', price: 300, baseRent: 26, colorGroup: 'Green', housePrice: 200, rentWithHouses: [130, 390, 900, 1100, 1275] },
  { id: 'north_carolina' as PropertyId, name: 'North Carolina Avenue', type: 'PROPERTY', price: 300, baseRent: 26, colorGroup: 'Green', housePrice: 200, rentWithHouses: [130, 390, 900, 1100, 1275] },
  { id: 'chest3' as PropertyId, name: 'Community Chest', type: 'CHEST' },
  { id: 'pennsylvania' as PropertyId, name: 'Pennsylvania Avenue', type: 'PROPERTY', price: 320, baseRent: 28, colorGroup: 'Green', housePrice: 200, rentWithHouses: [150, 450, 1000, 1200, 1400] },
  { id: 'short_line' as PropertyId, name: 'Short Line', type: 'PROPERTY', price: 200, baseRent: 25, colorGroup: 'Railroad' },
  { id: 'chance3' as PropertyId, name: 'Chance', type: 'CHANCE' },
  { id: 'park_place' as PropertyId, name: 'Park Place', type: 'PROPERTY', price: 350, baseRent: 35, colorGroup: 'DarkBlue', housePrice: 200, rentWithHouses: [175, 500, 1100, 1300, 1500] },
  { id: 'tax2' as PropertyId, name: 'Luxury Tax', type: 'TAX' },
  { id: 'boardwalk' as PropertyId, name: 'Boardwalk', type: 'PROPERTY', price: 400, baseRent: 50, colorGroup: 'DarkBlue', housePrice: 200, rentWithHouses: [200, 600, 1400, 1700, 2000] },
];
