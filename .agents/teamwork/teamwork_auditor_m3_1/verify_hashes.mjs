import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const referenceDir = 'C:\\Users\\angel\\Notes\\.obsidian\\plugins\\obsidian-manim-plugin';
const expectedHashes = {
    '.editorconfig': '35BC98C862A1107F3979DB655000BF0C463E4D1F230B6956E4382CC90FFE4853',
    '.gitignore': 'FE9DCF3CC7427FE859FCD8A70581E2EECA3BB40CE56E8C4B3BBD341601BD7015',
    '.npmrc': 'C6BA6C2E7FEC927F6BFA4C080BE5141B79FEBE9C7EDC2B2FBB8E333F160DDCB9',
    'data.json': '83D26B8A728BC89B8303B24D8EF8C6A88652ABC1B45D200D6BDBD8282F93C46C',
    'esbuild.config.mjs': '7B4D18B9FA35DC2BC3F91E9B0E05B4CA8F92E0B9A5C425C4434CC73CA041CD82',
    'eslint.config.mts': '91B0661F0090B8F2604E3594E6493700FCE9F959273EBF336A04D007F4ED0769',
    'LICENSE': '599F7D8E340311FEA1B1503A440D042DF4133F0753CCD248317508427449C693',
    'main.js': '5C76D4C9F1D36B82B641A007545E86142D334BBCC25D0F60065D32AF607828F3',
    'manifest.json': '1E1584B28E8C374817EACAC023DB4BD2DB06D26FFC65CD4778C532C5554234FB',
    'package-lock.json': 'C3429806EFC6952F4E5895F3683466BFC56461E32642A6AD63929CFEFE5E3F55',
    'package.json': 'D5FF47F51FB78124DCC2F99C7B22E6144350936035B290176C7965DD39E82173',
    'README.md': 'C59322AB1457F9F2F571DD006E59FC58A1956228BA385A29F4601D7EC26A9D6A',
    'styles.css': '1E8648FE5564177375A935F6B444A6F9661FA61DA625477745929F146162B4DD',
    'tsconfig.json': '371E452B260683F14E064B173CF99C192FCA0CC3DB1A5E5DD51A49458BCFC51A',
    'version-bump.mjs': '63B26A1497C83CF29908CC6E8A70839522DE945D55365AF9232A5C9AFB246453',
    'versions.json': '6B773100778ABDD1932FA2E8128E8E810CAACAA39D629D9AB515C28E43481D28',
    [path.join('.github', 'workflows', 'lint.yml')]: 'C50481B6CDD91501B94DD791DE32E2B8F6B6FC81AB7BFC5C9D4D9A8972551B3B',
    [path.join('src', 'codeBlockProcessor.ts')]: 'E6C6D34A3B75A881B98B4D9E5EF1487B0E7E29267D284C645BDD72DF672572B3',
    [path.join('src', 'editorChild.ts')]: 'BE600B1F27A23C56176F7DE38A6E95FD30E6FB7C4E5857F908B269C825531559',
    [path.join('src', 'editorStyle.ts')]: 'AFA131E612EA87A360D57F861CC4015260D9C756DDA66089751C83C1C5C62BE8',
    [path.join('src', 'editorThemes.ts')]: 'AF9203203F71320260B77676B2FCAE433180E510B2F578D15F0BDA05E67C2981',
    [path.join('src', 'main.ts')]: 'BE81FAFFEE12D58D495599FFE285908CA3FB0BCA17C5A3AF795D076E981AF075',
    [path.join('src', 'runtime.ts')]: '69441028031A6CBFD66F66B7A3A91B0AA6C3D2B2AC9EEABD976578A071172055',
    [path.join('src', 'settings.ts')]: 'F84AD1CF754AD4CD6803EF4E8134061E9C34387E0A5E93663F696419DFDF609D',
    [path.join('src', 'sourcePersistence.ts')]: 'E68F73BF4AF779DB94D4B43F8EDF3988833DB94AA8F10BC46A0BDE245D1D7AC6',
    [path.join('src', 'stateStore.ts')]: '18BCF8C5BAF37E39449820FE604B5B0EDFA77B5C0E83E0D138D72FB7590D0756'
};

function getAllFiles(dir, base = '') {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = base ? path.join(base, entry.name) : entry.name;
        if (entry.isDirectory()) {
            results = results.concat(getAllFiles(fullPath, relPath));
        } else if (entry.isFile()) {
            results.push({ fullPath, relPath });
        }
    }
    return results;
}

const foundFiles = getAllFiles(referenceDir);
console.log(`Discovered ${foundFiles.length} non-node_modules files.`);

let allClean = true;
const checkedSet = new Set();

for (const { fullPath, relPath } of foundFiles) {
    checkedSet.add(relPath);
    const content = fs.readFileSync(fullPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
    const expected = expectedHashes[relPath];

    if (!expected) {
        console.error(`TAMPER DETECTED: Unexpected new file ${relPath} (hash: ${hash})`);
        allClean = false;
    } else if (hash !== expected) {
        console.error(`TAMPER DETECTED: Hash mismatch in ${relPath}!`);
        console.error(`  Expected: ${expected}`);
        console.error(`  Actual:   ${hash}`);
        allClean = false;
    } else {
        console.log(`[PASS] ${relPath}: ${hash}`);
    }
}

for (const expRel of Object.keys(expectedHashes)) {
    if (!checkedSet.has(expRel)) {
        console.error(`TAMPER DETECTED: Missing file ${expRel}`);
        allClean = false;
    }
}

if (allClean && foundFiles.length === 26) {
    console.log(`\nVERDICT: REFERENCE REPOSITORY COMPLETELY UNTOUCHED (26/26 files verified)`);
    process.exit(0);
} else {
    console.error(`\nVERDICT: DIRECTORY TAMPERING VIOLATION DETECTED`);
    process.exit(1);
}
