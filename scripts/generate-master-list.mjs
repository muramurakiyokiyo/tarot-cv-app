import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { writeFile } from 'fs/promises';

const MASTER_DIR = join(process.cwd(), 'public', 'master');
const OUTPUT_FILE = join(process.cwd(), 'public', 'lib', 'master-list.json');

async function generateMasterList() {
  try {
    console.log('マスター画像リストを生成中...');
    console.log(`スキャン対象: ${MASTER_DIR}`);

    // public/master ディレクトリが存在するか確認
    let entries;
    try {
      entries = await readdir(MASTER_DIR);
    } catch (error) {
      console.error(`エラー: ${MASTER_DIR} が見つかりません`);
      process.exit(1);
    }

    const masterList = {};

    // 各カードフォルダをスキャン
    for (const entry of entries) {
      const cardPath = join(MASTER_DIR, entry);
      const cardStat = await stat(cardPath);

      // ディレクトリの場合のみ処理
      if (cardStat.isDirectory()) {
        const cardName = entry;
        const imageFiles = [];

        // カードフォルダ内の画像ファイルをスキャン
        const cardFiles = await readdir(cardPath);
        for (const file of cardFiles) {
          const filePath = join(cardPath, file);
          const fileStat = await stat(filePath);

          // 画像ファイル（.jpg, .jpeg, .png, .webp）のみを対象
          if (fileStat.isFile()) {
            const ext = file.toLowerCase();
            if (ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || ext.endsWith('.webp')) {
              imageFiles.push(file);
            }
          }
        }

        if (imageFiles.length > 0) {
          masterList[cardName] = imageFiles.sort();
          console.log(`✓ ${cardName}: ${imageFiles.length} 枚の画像を検出`);
        } else {
          console.warn(`⚠ ${cardName}: 画像ファイルが見つかりません`);
        }
      }
    }

    // public/lib ディレクトリが存在しない場合は作成
    const libDir = join(process.cwd(), 'public', 'lib');
    try {
      await stat(libDir);
    } catch {
      const { mkdir } = await import('fs/promises');
      await mkdir(libDir, { recursive: true });
      console.log(`✓ ${libDir} ディレクトリを作成しました`);
    }

    // JSONファイルに出力
    const jsonContent = JSON.stringify(masterList, null, 2);
    await writeFile(OUTPUT_FILE, jsonContent, 'utf-8');

    const cardCount = Object.keys(masterList).length;
    const totalImages = Object.values(masterList).reduce((sum, files) => sum + files.length, 0);

    console.log(`\n✓ マスターリスト生成完了:`);
    console.log(`  - カード数: ${cardCount}`);
    console.log(`  - 総画像数: ${totalImages}`);
    console.log(`  - 出力先: ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  }
}

generateMasterList();

