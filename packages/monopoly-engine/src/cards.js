"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMUNITY_CHEST_CARDS = exports.CHANCE_CARDS = void 0;
exports.CHANCE_CARDS = [
    { id: 'chance_advance_go', text: 'Advance to "GO". (Collect $200)', action: 'MOVE_TO_POSITION', propertyId: 'go', value: 0 },
    { id: 'chance_advance_illinois', text: 'Advance to Illinois Ave. If you pass GO, collect $200.', action: 'MOVE_TO_POSITION', propertyId: 'illinois', value: 24 },
    { id: 'chance_advance_st_charles', text: 'Advance to St. Charles Place. If you pass GO, collect $200.', action: 'MOVE_TO_POSITION', propertyId: 'st_charles', value: 11 },
    { id: 'chance_nearest_util', text: 'Advance token to nearest Utility. If unowned, you may buy it from the Bank. If owned, throw dice and pay owner a total 10 times the amount thrown.', action: 'MOVE_TO_NEAREST_UTIL' },
    { id: 'chance_nearest_rr_1', text: 'Advance token to the nearest Railroad and pay owner twice the rental to which they are otherwise entitled. If Railroad is unowned, you may buy it from the Bank.', action: 'MOVE_TO_NEAREST_RR' },
    { id: 'chance_nearest_rr_2', text: 'Advance token to the nearest Railroad and pay owner twice the rental to which they are otherwise entitled. If Railroad is unowned, you may buy it from the Bank.', action: 'MOVE_TO_NEAREST_RR' },
    { id: 'chance_bank_dividend', text: 'Bank pays you dividend of $50.', action: 'COLLECT_MONEY', value: 50 },
    { id: 'chance_jail_free', text: 'Get out of Jail Free. This card may be kept until needed, or traded/sold.', action: 'GET_OUT_OF_JAIL_FREE' },
    { id: 'chance_back_3', text: 'Go Back 3 Spaces.', action: 'MOVE_BACKWARDS', value: 3 },
    { id: 'chance_go_to_jail', text: 'Go to Jail. Go directly to Jail. Do not pass GO, do not collect $200.', action: 'GO_TO_JAIL' },
    { id: 'chance_repairs', text: 'Make general repairs on all your property: For each house pay $25, For each hotel $100.', action: 'PROPERTY_REPAIRS', houseCost: 25, hotelCost: 100 },
    { id: 'chance_poor_tax', text: 'Pay poor tax of $15.', action: 'PAY_MONEY', value: 15 },
    { id: 'chance_reading_rr', text: 'Take a trip to Reading Railroad. If you pass GO, collect $200.', action: 'MOVE_TO_POSITION', propertyId: 'reading', value: 5 },
    { id: 'chance_boardwalk', text: 'Take a walk on the Boardwalk. Advance token to Boardwalk.', action: 'MOVE_TO_POSITION', propertyId: 'boardwalk', value: 39 },
    { id: 'chance_chairman', text: 'You have been elected Chairman of the Board. Pay each player $50.', action: 'PAY_PLAYERS', value: 50 },
    { id: 'chance_loan_matures', text: 'Your building and loan matures. Collect $150.', action: 'COLLECT_MONEY', value: 150 },
];
exports.COMMUNITY_CHEST_CARDS = [
    { id: 'chest_advance_go', text: 'Advance to "GO". (Collect $200)', action: 'MOVE_TO_POSITION', propertyId: 'go', value: 0 },
    { id: 'chest_bank_error', text: 'Bank error in your favor. Collect $200.', action: 'COLLECT_MONEY', value: 200 },
    { id: 'chest_doctors_fee', text: 'Doctor\'s fees. Pay $50.', action: 'PAY_MONEY', value: 50 },
    { id: 'chest_stock_sale', text: 'From sale of stock you get $50.', action: 'COLLECT_MONEY', value: 50 },
    { id: 'chest_jail_free', text: 'Get out of Jail Free. This card may be kept until needed, or sold/traded.', action: 'GET_OUT_OF_JAIL_FREE' },
    { id: 'chest_go_to_jail', text: 'Go to Jail. Go directly to jail. Do not pass GO, do not collect $200.', action: 'GO_TO_JAIL' },
    { id: 'chest_opera', text: 'Grand Opera Night. Collect $50 from every player for opening night seats.', action: 'COLLECT_FROM_PLAYERS', value: 50 },
    { id: 'chest_holiday_fund', text: 'Holiday Fund matures. Receive $100.', action: 'COLLECT_MONEY', value: 100 },
    { id: 'chest_tax_refund', text: 'Income tax refund. Collect $20.', action: 'COLLECT_MONEY', value: 20 },
    { id: 'chest_birthday', text: 'It is your birthday. Collect $10 from every player.', action: 'COLLECT_FROM_PLAYERS', value: 10 },
    { id: 'chest_life_insurance', text: 'Life insurance matures. Collect $100.', action: 'COLLECT_MONEY', value: 100 },
    { id: 'chest_hospital', text: 'Hospital Fees. Pay $100.', action: 'PAY_MONEY', value: 100 },
    { id: 'chest_school_fee', text: 'School fees. Pay $50.', action: 'PAY_MONEY', value: 50 },
    { id: 'chest_consultancy', text: 'Receive $25 consultancy fee.', action: 'COLLECT_MONEY', value: 25 },
    { id: 'chest_street_repairs', text: 'You are assessed for street repairs: Pay $40 per house and $115 per hotel you own.', action: 'PROPERTY_REPAIRS', houseCost: 40, hotelCost: 115 },
    { id: 'chest_beauty_contest', text: 'You have won second prize in a beauty contest. Collect $10.', action: 'COLLECT_MONEY', value: 10 },
];
