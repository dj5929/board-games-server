

export interface BoardNode {
  taxi: number[];
  bus: number[];
  underground: number[];
  secret: number[];
}

export const scotlandYardGraph: Record<number, BoardNode> = {
  "1": {
    "taxi": [
      8,
      9
    ],
    "bus": [
      46,
      58
    ],
    "underground": [
      46
    ],
    "secret": []
  },
  "2": {
    "taxi": [
      10,
      20
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "3": {
    "taxi": [
      4,
      11,
      12
    ],
    "bus": [
      22,
      23
    ],
    "underground": [],
    "secret": []
  },
  "4": {
    "taxi": [
      3,
      13
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "5": {
    "taxi": [
      15,
      16
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "6": {
    "taxi": [
      7,
      29
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "7": {
    "taxi": [
      6,
      17
    ],
    "bus": [
      42
    ],
    "underground": [],
    "secret": []
  },
  "8": {
    "taxi": [
      1,
      18,
      19
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "9": {
    "taxi": [
      1,
      19,
      20
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "10": {
    "taxi": [
      2,
      11,
      21,
      34
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "11": {
    "taxi": [
      3,
      10,
      22
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "12": {
    "taxi": [
      3,
      23
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "13": {
    "taxi": [
      4,
      14,
      23,
      24
    ],
    "bus": [
      14,
      23,
      52
    ],
    "underground": [
      46,
      67,
      89
    ],
    "secret": []
  },
  "14": {
    "taxi": [
      13,
      15,
      25
    ],
    "bus": [
      13,
      15
    ],
    "underground": [],
    "secret": []
  },
  "15": {
    "taxi": [
      5,
      14,
      16,
      26,
      28
    ],
    "bus": [
      14,
      29,
      41
    ],
    "underground": [],
    "secret": []
  },
  "16": {
    "taxi": [
      5,
      15,
      28,
      29
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "17": {
    "taxi": [
      7,
      29,
      30
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "18": {
    "taxi": [
      8,
      31,
      43
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "19": {
    "taxi": [
      8,
      9,
      32
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "20": {
    "taxi": [
      2,
      9,
      33
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "21": {
    "taxi": [
      10,
      33
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "22": {
    "taxi": [
      11,
      23,
      34,
      35
    ],
    "bus": [
      3,
      23,
      34,
      65
    ],
    "underground": [],
    "secret": []
  },
  "23": {
    "taxi": [
      12,
      13,
      22,
      37
    ],
    "bus": [
      3,
      13,
      22,
      67
    ],
    "underground": [],
    "secret": []
  },
  "24": {
    "taxi": [
      13,
      37,
      38
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "25": {
    "taxi": [
      14,
      38,
      39
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "26": {
    "taxi": [
      15,
      27,
      39
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "27": {
    "taxi": [
      26,
      28,
      40
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "28": {
    "taxi": [
      15,
      16,
      27,
      41
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "29": {
    "taxi": [
      6,
      16,
      17,
      41,
      42
    ],
    "bus": [
      15,
      41,
      42,
      55
    ],
    "underground": [],
    "secret": []
  },
  "30": {
    "taxi": [
      17,
      42
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "31": {
    "taxi": [
      18,
      43,
      44
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "32": {
    "taxi": [
      19,
      33,
      44,
      45
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "33": {
    "taxi": [
      20,
      21,
      32,
      46
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "34": {
    "taxi": [
      10,
      22,
      47,
      48
    ],
    "bus": [
      22,
      46,
      63
    ],
    "underground": [],
    "secret": []
  },
  "35": {
    "taxi": [
      22,
      36,
      48,
      65
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "36": {
    "taxi": [
      35,
      37,
      49
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "37": {
    "taxi": [
      23,
      24,
      36,
      50
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "38": {
    "taxi": [
      24,
      25,
      50,
      51
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "39": {
    "taxi": [
      25,
      26,
      51,
      52
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "40": {
    "taxi": [
      27,
      41,
      52,
      53
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "41": {
    "taxi": [
      28,
      29,
      40,
      54
    ],
    "bus": [
      15,
      29,
      52,
      87
    ],
    "underground": [],
    "secret": []
  },
  "42": {
    "taxi": [
      29,
      30,
      56,
      72
    ],
    "bus": [
      7,
      29,
      72
    ],
    "underground": [],
    "secret": []
  },
  "43": {
    "taxi": [
      18,
      31,
      57
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "44": {
    "taxi": [
      31,
      32,
      58
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "45": {
    "taxi": [
      32,
      46,
      58,
      59,
      60
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "46": {
    "taxi": [
      33,
      45,
      47,
      61
    ],
    "bus": [
      1,
      34,
      58,
      78
    ],
    "underground": [
      1,
      13,
      74,
      79
    ],
    "secret": []
  },
  "47": {
    "taxi": [
      34,
      46,
      62
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "48": {
    "taxi": [
      34,
      35,
      62,
      63
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "49": {
    "taxi": [
      36,
      50,
      66
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "50": {
    "taxi": [
      37,
      38,
      49
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "51": {
    "taxi": [
      38,
      39,
      52,
      67,
      68
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "52": {
    "taxi": [
      39,
      40,
      51,
      69
    ],
    "bus": [
      13,
      41,
      67,
      86
    ],
    "underground": [],
    "secret": []
  },
  "53": {
    "taxi": [
      40,
      54,
      69
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "54": {
    "taxi": [
      41,
      53,
      55,
      70
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "55": {
    "taxi": [
      54,
      71
    ],
    "bus": [
      29,
      89
    ],
    "underground": [],
    "secret": []
  },
  "56": {
    "taxi": [
      42,
      91
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "57": {
    "taxi": [
      43,
      58,
      73
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "58": {
    "taxi": [
      44,
      45,
      57,
      59,
      74,
      75
    ],
    "bus": [
      1,
      46,
      74,
      77
    ],
    "underground": [],
    "secret": []
  },
  "59": {
    "taxi": [
      45,
      58,
      75,
      76
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "60": {
    "taxi": [
      45,
      61,
      76
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "61": {
    "taxi": [
      46,
      60,
      62,
      76,
      78
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "62": {
    "taxi": [
      47,
      48,
      61,
      79
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "63": {
    "taxi": [
      48,
      64,
      79,
      80
    ],
    "bus": [
      34,
      65,
      79,
      100
    ],
    "underground": [],
    "secret": []
  },
  "64": {
    "taxi": [
      63,
      65,
      81
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "65": {
    "taxi": [
      35,
      64,
      66,
      82
    ],
    "bus": [
      22,
      63,
      67,
      82
    ],
    "underground": [],
    "secret": []
  },
  "66": {
    "taxi": [
      49,
      65,
      67,
      82
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "67": {
    "taxi": [
      51,
      66,
      68,
      84
    ],
    "bus": [
      23,
      52,
      65,
      82,
      102
    ],
    "underground": [
      13,
      79,
      89,
      111
    ],
    "secret": []
  },
  "68": {
    "taxi": [
      51,
      67,
      69,
      85
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "69": {
    "taxi": [
      52,
      53,
      68,
      86
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "70": {
    "taxi": [
      54,
      71,
      87
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "71": {
    "taxi": [
      55,
      70,
      72,
      89
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "72": {
    "taxi": [
      42,
      71,
      90,
      91
    ],
    "bus": [
      42,
      105,
      107
    ],
    "underground": [],
    "secret": []
  },
  "73": {
    "taxi": [
      57,
      74,
      92
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "74": {
    "taxi": [
      58,
      73,
      75,
      92
    ],
    "bus": [
      58,
      94
    ],
    "underground": [
      46
    ],
    "secret": []
  },
  "75": {
    "taxi": [
      58,
      59,
      74,
      94
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "76": {
    "taxi": [
      59,
      60,
      61,
      77
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "77": {
    "taxi": [
      76,
      78,
      95,
      96
    ],
    "bus": [
      58,
      78,
      94,
      124
    ],
    "underground": [],
    "secret": []
  },
  "78": {
    "taxi": [
      61,
      77,
      79,
      97
    ],
    "bus": [
      46,
      77,
      79
    ],
    "underground": [],
    "secret": []
  },
  "79": {
    "taxi": [
      62,
      63,
      78,
      98
    ],
    "bus": [
      63,
      78
    ],
    "underground": [
      46,
      67,
      93,
      111
    ],
    "secret": []
  },
  "80": {
    "taxi": [
      63,
      99,
      100
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "81": {
    "taxi": [
      64,
      82,
      100
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "82": {
    "taxi": [
      65,
      66,
      81,
      101
    ],
    "bus": [
      65,
      67,
      100,
      140
    ],
    "underground": [],
    "secret": []
  },
  "83": {
    "taxi": [
      101,
      102
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "84": {
    "taxi": [
      67,
      85
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "85": {
    "taxi": [
      68,
      84,
      103
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "86": {
    "taxi": [
      69,
      103,
      104
    ],
    "bus": [
      52,
      87,
      102,
      116
    ],
    "underground": [],
    "secret": []
  },
  "87": {
    "taxi": [
      70,
      88
    ],
    "bus": [
      41,
      86,
      105
    ],
    "underground": [],
    "secret": []
  },
  "88": {
    "taxi": [
      87,
      89,
      117
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "89": {
    "taxi": [
      71,
      88,
      105
    ],
    "bus": [
      55,
      105
    ],
    "underground": [
      13,
      67,
      128,
      140
    ],
    "secret": []
  },
  "90": {
    "taxi": [
      72,
      91,
      105
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "91": {
    "taxi": [
      56,
      72,
      90,
      105,
      107
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "92": {
    "taxi": [
      73,
      74,
      93
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "93": {
    "taxi": [
      92,
      94
    ],
    "bus": [
      94
    ],
    "underground": [
      79
    ],
    "secret": []
  },
  "94": {
    "taxi": [
      75,
      93,
      95
    ],
    "bus": [
      74,
      77,
      93
    ],
    "underground": [],
    "secret": []
  },
  "95": {
    "taxi": [
      77,
      94,
      122
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "96": {
    "taxi": [
      77,
      97,
      109
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "97": {
    "taxi": [
      78,
      96,
      98,
      109
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "98": {
    "taxi": [
      79,
      97,
      99,
      110
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "99": {
    "taxi": [
      80,
      98,
      110,
      112
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "100": {
    "taxi": [
      80,
      81,
      101,
      112,
      113
    ],
    "bus": [
      63,
      82,
      111
    ],
    "underground": [],
    "secret": []
  },
  "101": {
    "taxi": [
      82,
      83,
      100,
      114
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "102": {
    "taxi": [
      83,
      103,
      115
    ],
    "bus": [
      67,
      86,
      127
    ],
    "underground": [],
    "secret": []
  },
  "103": {
    "taxi": [
      85,
      86,
      102
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "104": {
    "taxi": [
      86,
      116
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "105": {
    "taxi": [
      89,
      90,
      91,
      106,
      108
    ],
    "bus": [
      72,
      87,
      89,
      107,
      108
    ],
    "underground": [],
    "secret": []
  },
  "106": {
    "taxi": [
      105,
      107
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "107": {
    "taxi": [
      91,
      106,
      119
    ],
    "bus": [
      72,
      105,
      161
    ],
    "underground": [],
    "secret": []
  },
  "108": {
    "taxi": [
      105,
      117,
      119
    ],
    "bus": [
      105,
      116,
      135
    ],
    "underground": [],
    "secret": [
      115
    ]
  },
  "109": {
    "taxi": [
      96,
      97,
      110,
      124
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "110": {
    "taxi": [
      98,
      99,
      109,
      111
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "111": {
    "taxi": [
      110,
      112,
      124
    ],
    "bus": [
      100,
      124
    ],
    "underground": [
      67,
      79,
      153,
      163
    ],
    "secret": []
  },
  "112": {
    "taxi": [
      99,
      100,
      111,
      125
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "113": {
    "taxi": [
      100,
      114,
      125
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "114": {
    "taxi": [
      101,
      113,
      115,
      126,
      131,
      132
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "115": {
    "taxi": [
      102,
      114,
      126,
      127
    ],
    "bus": [],
    "underground": [],
    "secret": [
      108,
      157
    ]
  },
  "116": {
    "taxi": [
      104,
      117,
      118,
      127
    ],
    "bus": [
      86,
      108,
      127,
      142
    ],
    "underground": [],
    "secret": []
  },
  "117": {
    "taxi": [
      88,
      108,
      116,
      129
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "118": {
    "taxi": [
      116,
      129,
      134,
      142
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "119": {
    "taxi": [
      107,
      108,
      136
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "120": {
    "taxi": [
      121,
      144
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "121": {
    "taxi": [
      120,
      122,
      145
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "122": {
    "taxi": [
      95,
      121,
      123,
      146
    ],
    "bus": [
      123,
      144
    ],
    "underground": [],
    "secret": []
  },
  "123": {
    "taxi": [
      122,
      124,
      137,
      148,
      149
    ],
    "bus": [
      122,
      124,
      144,
      165
    ],
    "underground": [],
    "secret": []
  },
  "124": {
    "taxi": [
      109,
      111,
      123,
      130,
      138
    ],
    "bus": [
      77,
      111,
      123,
      153
    ],
    "underground": [],
    "secret": []
  },
  "125": {
    "taxi": [
      112,
      113,
      131
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "126": {
    "taxi": [
      114,
      115,
      127,
      140
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "127": {
    "taxi": [
      115,
      116,
      126,
      133,
      134
    ],
    "bus": [
      102,
      116,
      133
    ],
    "underground": [],
    "secret": []
  },
  "128": {
    "taxi": [
      142,
      143,
      160,
      172,
      188
    ],
    "bus": [
      135,
      142,
      161,
      187,
      199
    ],
    "underground": [
      89,
      140,
      185
    ],
    "secret": []
  },
  "129": {
    "taxi": [
      117,
      118,
      135,
      142,
      143
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "130": {
    "taxi": [
      124,
      131,
      139
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "131": {
    "taxi": [
      114,
      125,
      130
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "132": {
    "taxi": [
      114,
      140
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "133": {
    "taxi": [
      127,
      140,
      141
    ],
    "bus": [
      127,
      140,
      157
    ],
    "underground": [],
    "secret": []
  },
  "134": {
    "taxi": [
      118,
      127,
      141,
      142
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "135": {
    "taxi": [
      129,
      136,
      143,
      161
    ],
    "bus": [
      108,
      128,
      161
    ],
    "underground": [],
    "secret": []
  },
  "136": {
    "taxi": [
      119,
      135,
      162
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "137": {
    "taxi": [
      123,
      147
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "138": {
    "taxi": [
      124,
      150,
      152
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "139": {
    "taxi": [
      130,
      140,
      153,
      154
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "140": {
    "taxi": [
      126,
      132,
      133,
      139,
      154,
      156
    ],
    "bus": [
      82,
      133,
      154,
      156
    ],
    "underground": [
      89,
      128,
      153
    ],
    "secret": []
  },
  "141": {
    "taxi": [
      133,
      134,
      142,
      158
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "142": {
    "taxi": [
      118,
      128,
      129,
      134,
      141,
      143,
      158
    ],
    "bus": [
      116,
      128,
      157
    ],
    "underground": [],
    "secret": []
  },
  "143": {
    "taxi": [
      128,
      129,
      135,
      142,
      160
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "144": {
    "taxi": [
      120,
      145,
      177
    ],
    "bus": [
      122,
      123,
      163
    ],
    "underground": [],
    "secret": []
  },
  "145": {
    "taxi": [
      121,
      144,
      146
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "146": {
    "taxi": [
      122,
      145,
      147,
      163
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "147": {
    "taxi": [
      137,
      146,
      164
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "148": {
    "taxi": [
      123,
      149,
      164
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "149": {
    "taxi": [
      123,
      148,
      150,
      165
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "150": {
    "taxi": [
      138,
      149,
      151
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "151": {
    "taxi": [
      150,
      152,
      165,
      166
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "152": {
    "taxi": [
      138,
      151,
      153
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "153": {
    "taxi": [
      139,
      152,
      154,
      166,
      167
    ],
    "bus": [
      124,
      154,
      180,
      184
    ],
    "underground": [
      111,
      140,
      163,
      185
    ],
    "secret": []
  },
  "154": {
    "taxi": [
      139,
      140,
      153,
      155
    ],
    "bus": [
      140,
      153,
      156
    ],
    "underground": [],
    "secret": []
  },
  "155": {
    "taxi": [
      154,
      156,
      167,
      168
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "156": {
    "taxi": [
      140,
      155,
      157,
      169
    ],
    "bus": [
      140,
      154,
      157,
      184
    ],
    "underground": [],
    "secret": []
  },
  "157": {
    "taxi": [
      156,
      158,
      170
    ],
    "bus": [
      133,
      142,
      156,
      185
    ],
    "underground": [],
    "secret": [
      115,
      194
    ]
  },
  "158": {
    "taxi": [
      141,
      142,
      157,
      159
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "159": {
    "taxi": [
      158,
      170,
      172,
      186,
      198
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "160": {
    "taxi": [
      128,
      143,
      161,
      173
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "161": {
    "taxi": [
      135,
      160,
      174
    ],
    "bus": [
      107,
      128,
      135,
      199
    ],
    "underground": [],
    "secret": []
  },
  "162": {
    "taxi": [
      136,
      175
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "163": {
    "taxi": [
      146,
      177
    ],
    "bus": [
      144,
      176,
      191
    ],
    "underground": [
      111,
      153
    ],
    "secret": []
  },
  "164": {
    "taxi": [
      147,
      148,
      178,
      179
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "165": {
    "taxi": [
      149,
      151,
      179,
      180
    ],
    "bus": [
      123,
      180,
      191
    ],
    "underground": [],
    "secret": []
  },
  "166": {
    "taxi": [
      151,
      153,
      181,
      183
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "167": {
    "taxi": [
      153,
      155,
      168,
      183
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "168": {
    "taxi": [
      155,
      167,
      184
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "169": {
    "taxi": [
      156,
      184
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "170": {
    "taxi": [
      157,
      159,
      185
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "171": {
    "taxi": [
      173,
      175,
      199
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "172": {
    "taxi": [
      128,
      159,
      187
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "173": {
    "taxi": [
      160,
      171,
      174,
      188
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "174": {
    "taxi": [
      161,
      173,
      175
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "175": {
    "taxi": [
      162,
      171,
      174
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "176": {
    "taxi": [
      177,
      189
    ],
    "bus": [
      163,
      190
    ],
    "underground": [],
    "secret": []
  },
  "177": {
    "taxi": [
      144,
      163,
      176
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "178": {
    "taxi": [
      164,
      189,
      191
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "179": {
    "taxi": [
      164,
      165,
      191
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "180": {
    "taxi": [
      165,
      181,
      193
    ],
    "bus": [
      153,
      165,
      184,
      190
    ],
    "underground": [],
    "secret": []
  },
  "181": {
    "taxi": [
      166,
      180,
      182,
      193
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "182": {
    "taxi": [
      181,
      183,
      195
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "183": {
    "taxi": [
      166,
      167,
      182,
      196
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "184": {
    "taxi": [
      168,
      169,
      185,
      196,
      197
    ],
    "bus": [
      153,
      156,
      180,
      185
    ],
    "underground": [],
    "secret": []
  },
  "185": {
    "taxi": [
      170,
      184,
      186
    ],
    "bus": [
      157,
      184,
      187
    ],
    "underground": [
      128,
      153
    ],
    "secret": []
  },
  "186": {
    "taxi": [
      159,
      185,
      198
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "187": {
    "taxi": [
      172,
      188,
      198
    ],
    "bus": [
      128,
      185
    ],
    "underground": [],
    "secret": []
  },
  "188": {
    "taxi": [
      128,
      173,
      187,
      199
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "189": {
    "taxi": [
      176,
      178,
      190
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "190": {
    "taxi": [
      189,
      191,
      192
    ],
    "bus": [
      176,
      180,
      191
    ],
    "underground": [],
    "secret": []
  },
  "191": {
    "taxi": [
      178,
      179,
      190,
      192
    ],
    "bus": [
      163,
      165,
      190
    ],
    "underground": [],
    "secret": []
  },
  "192": {
    "taxi": [
      190,
      191,
      194
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "193": {
    "taxi": [
      180,
      181,
      194
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "194": {
    "taxi": [
      192,
      193,
      195
    ],
    "bus": [],
    "underground": [],
    "secret": [
      157
    ]
  },
  "195": {
    "taxi": [
      182,
      194,
      197
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "196": {
    "taxi": [
      183,
      184,
      197
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "197": {
    "taxi": [
      184,
      195,
      196
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "198": {
    "taxi": [
      159,
      186,
      187,
      199
    ],
    "bus": [],
    "underground": [],
    "secret": []
  },
  "199": {
    "taxi": [
      171,
      188,
      198
    ],
    "bus": [
      128,
      161
    ],
    "underground": [],
    "secret": []
  }
};
