import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ID = '8992520454821531974';
const BASE_DIR = path.resolve('design');
const SCREENS_DIR = path.join(BASE_DIR, 'screens');

fs.mkdirSync(SCREENS_DIR, { recursive: true });

console.log(`Fetching Stitch project metadata for ${PROJECT_ID}...`);
const projectJsonRaw = execSync(`stitch get project ${PROJECT_ID} --json`, { encoding: 'utf8' });
const projectData = JSON.parse(projectJsonRaw).data;

// 1. Export Design System MD
if (projectData.designTheme?.designMd) {
  const designMdPath = path.join(BASE_DIR, 'design-system.md');
  fs.writeFileSync(designMdPath, projectData.designTheme.designMd, 'utf8');
  console.log(`✅ Saved ${designMdPath}`);
}

// 2. Export Design Tokens JSON
const tokens = {
  title: projectData.title,
  deviceType: projectData.deviceType,
  designTheme: projectData.designTheme,
};
const tokensPath = path.join(BASE_DIR, 'tokens.json');
fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), 'utf8');
console.log(`✅ Saved ${tokensPath}`);

// 3. Process all screen instances
const screenInstances = projectData.screenInstances || [];
console.log(`Found ${screenInstances.length} screen instances in canvas.`);

function slugify(text) {
  return (text || 'screen')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const catalog = [];

for (const inst of screenInstances) {
  // If it's an asset or text extraction, skip or handle separately
  if (!inst.sourceScreen || inst.type === 'DESIGN_SYSTEM_INSTANCE') {
    continue;
  }
  
  const screenId = inst.sourceScreen.split('/').pop();
  const label = inst.label || 'Screen';
  const slug = slugify(label);
  const outDir = path.join(SCREENS_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Downloading screen: "${label}" (${screenId}) into ${slug}/...`);
  try {
    execSync(`stitch download screen ${screenId} --project ${PROJECT_ID} --html --image --output "${outDir}"`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    console.log(`  ✓ Saved artifacts for ${label}`);
  } catch (err) {
    // Some screens might not have screenshot images, try html only
    try {
      execSync(`stitch download screen ${screenId} --project ${PROJECT_ID} --html --output "${outDir}"`, {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      console.log(`  ✓ Saved HTML only for ${label}`);
    } catch (err2) {
      console.warn(`  ⚠️ Could not download screen ${screenId}: ${err2.message}`);
    }
  }

  // Find generated files in outDir
  const files = fs.readdirSync(outDir);
  const htmlFile = files.find(f => f.endsWith('.html'));
  const imgFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));

  catalog.push({
    id: screenId,
    label,
    slug,
    hidden: !!inst.hidden,
    width: inst.width,
    height: inst.height,
    htmlPath: htmlFile ? path.join('screens', slug, htmlFile).replace(/\\/g, '/') : null,
    imgPath: imgFile ? path.join('screens', slug, imgFile).replace(/\\/g, '/') : null,
  });
}

// 4. Generate design/README.md catalog
const readmeLines = [
  `# Fi-Sync Design & UI Specifications (Google Stitch)`,
  ``,
  `Este diretório contém todos os artefatos visuais, código HTML/CSS, screenshots e definições de tokens exportados diretamente do **Google Stitch** para o **Fi-Sync**.`,
  ``,
  `* **Projeto:** [${projectData.title}](https://stitch.withgoogle.com)`,
  `* **Device:** \`${projectData.deviceType || 'MOBILE'}\``,
  `* **Tema:** Dark Mode com paleta Emerald Mint (\`#00E599\`) & Deep Slate Navy (\`#0C141E\`)`,
  `* **Documento do Design System:** [design-system.md](./design-system.md)`,
  `* **Tokens estruturados (JSON):** [tokens.json](./tokens.json)`,
  ``,
  `## 📱 Telas Principais (Canvas Ativo)`,
  ``,
  `| Tela | Visualização | HTML | Resolução |`,
  `| :--- | :--- | :--- | :--- |`,
];

const activeScreens = catalog.filter(s => !s.hidden);
const hiddenScreens = catalog.filter(s => s.hidden);

for (const s of activeScreens) {
  const imgLink = s.imgPath ? `![${s.label}](./${s.imgPath})` : '—';
  const htmlLink = s.htmlPath ? `[\`${path.basename(s.htmlPath)}\`](./${s.htmlPath})` : '—';
  readmeLines.push(`| **${s.label}** | ${imgLink} | ${htmlLink} | ${s.width}x${s.height} |`);
}

if (hiddenScreens.length > 0) {
  readmeLines.push(``);
  readmeLines.push(`## 🗃️ Telas Secundárias / Iterações Anteriores`);
  readmeLines.push(``);
  readmeLines.push(`| Tela | HTML | Resolução |`);
  readmeLines.push(`| :--- | :--- | :--- |`);
  for (const s of hiddenScreens) {
    const htmlLink = s.htmlPath ? `[\`${path.basename(s.htmlPath)}\`](./${s.htmlPath})` : '—';
    readmeLines.push(`| ${s.label} | ${htmlLink} | ${s.width}x${s.height} |`);
  }
}

fs.writeFileSync(path.join(BASE_DIR, 'README.md'), readmeLines.join('\n'), 'utf8');
console.log(`✅ Generated ${path.join(BASE_DIR, 'README.md')}`);
console.log(`\n🎉 All Stitch design assets downloaded successfully!`);

