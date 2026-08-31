const fs = require('fs');
const file = 'd:/Projects/BoardGameServer/packages/monopoly-engine/src/MonopolyEngine.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/import \{ BOARD_SPACES \} from '\.\/board';/, "import { BOARD_SPACES, BOARD_SPACES_MAP } from './board';");
content = content.replace(/BOARD_SPACES\.find\([a-zA-Z_]+\s*=>\s*[a-zA-Z_]+\.id\s*===\s*([a-zA-Z0-9_\.]+)\)/g, 'BOARD_SPACES_MAP.get($1)');
fs.writeFileSync(file, content);
