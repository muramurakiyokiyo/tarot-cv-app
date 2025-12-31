'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// 1つのマスター画像の特徴量データ
interface MasterImageData {
  keypoints: any;
  descriptors: any;
}

// 1つのカードの全マスター画像の特徴量データ（配列）
interface MasterData {
  images: MasterImageData[];
  displayName: string;
}

interface Candidate {
  cardName: string;
  matchCount: number;
}

interface DetectedRect {
  points: Array<{ x: number; y: number }>;
  area: number;
}

interface UseTarotReaderReturn {
  isCvLoaded: boolean;
  isMasterReady: boolean;
  isAnalyzing: boolean;
  hasSavedImage: boolean;
  candidates: Candidate[];
  blacklist: string[];
  detectedRect: DetectedRect | null;
  detectedRectImage: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  captureImage: () => void;
  deleteImage: () => void;
  addToBlacklist: (card: string) => void;
}

const STORAGE_KEY = 'tarot-captured-image';

// 大アルカナ22枚のIDリスト（master-list.jsonから動的に読み込むため、ここでは使用しない）
// const MAJOR_ARCANA_IDS = [
//   'FOOL',
//   'MAGICIAN',
//   'HIGHPRIESTESS',
//   'EMPRESS',
//   'EMPEROR',
//   'HIEROPHANT',
//   'LOVERS',
//   'CHARIOT',
//   'STRENGTH',
//   'HERMIT',
//   'WHEELOFFORTUNE',
//   'JUSTICE',
//   'HANGEDMAN',
//   'DEATH',
//   'TEMPERANCE',
//   'DEVIL',
//   'TOWER',
//   'STAR',
//   'MOON',
//   'SUN',
//   'JUDGEMENT',
//   'WORLD',
// ] as const;

// カードIDから表示名へのマッピング
const CARD_DISPLAY_NAMES: Record<string, string> = {
  FOOL: 'THE FOOL',
  MAGICIAN: 'THE MAGICIAN',
  HIGHPRIESTESS: 'THE HIGH PRIESTESS',
  EMPRESS: 'THE EMPRESS',
  EMPEROR: 'THE EMPEROR',
  HIEROPHANT: 'THE HIEROPHANT',
  LOVERS: 'THE LOVERS',
  CHARIOT: 'THE CHARIOT',
  STRENGTH: 'STRENGTH',
  HERMIT: 'THE HERMIT',
  WHEELOFFORTUNE: 'WHEEL OF FORTUNE',
  JUSTICE: 'JUSTICE',
  HANGEDMAN: 'THE HANGED MAN',
  DEATH: 'DEATH',
  TEMPERANCE: 'TEMPERANCE',
  DEVIL: 'THE DEVIL',
  TOWER: 'THE TOWER',
  STAR: 'THE STAR',
  MOON: 'THE MOON',
  SUN: 'THE SUN',
  JUDGEMENT: 'JUDGEMENT',
  WORLD: 'THE WORLD',
};

// 矩形の4点を左上、右上、右下、左下の順に並べ替える関数
function sortRectanglePoints(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length !== 4) return points;
  
  // 各点を左上、右上、右下、左下に分類
  // 左上: x+yが最小
  // 右下: x+yが最大
  // 右上: x-yが最大
  // 左下: x-yが最小
  const sum = points.map(p => ({ point: p, sum: p.x + p.y }));
  const diff = points.map(p => ({ point: p, diff: p.x - p.y }));
  
  const leftTop = sum.reduce((min, p) => p.sum < min.sum ? p : min, sum[0]).point;
  const rightBottom = sum.reduce((max, p) => p.sum > max.sum ? p : max, sum[0]).point;
  const rightTop = diff.reduce((max, p) => p.diff > max.diff ? p : max, diff[0]).point;
  const leftBottom = diff.reduce((min, p) => p.diff < min.diff ? p : min, diff[0]).point;
  
  return [leftTop, rightTop, rightBottom, leftBottom];
}

// 矩形の形状チェック関数（カードの形状に近いか確認）
function checkRectangleShape(points: Array<{ x: number; y: number }>): boolean {
  if (points.length !== 4) return false;
  
  // 4つの頂点から辺の長さを計算
  const distances: number[] = [];
  for (let i = 0; i < 4; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % 4];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    distances.push(dist);
  }
  
  // 対辺の長さがほぼ等しいかチェック（誤差10%以内）
  const opposite1Ratio = Math.min(distances[0], distances[2]) / Math.max(distances[0], distances[2]);
  const opposite2Ratio = Math.min(distances[1], distances[3]) / Math.max(distances[1], distances[3]);
  
  if (opposite1Ratio < 0.9 || opposite2Ratio < 0.9) {
    return false; // 対辺の長さが大きく異なる
  }
  
  // アスペクト比をチェック（カードは通常、縦長または横長の長方形）
  const width = Math.max(distances[0], distances[2]);
  const height = Math.max(distances[1], distances[3]);
  const aspectRatio = width / height;
  
  // アスペクト比が0.5～2.0の範囲内（カードの一般的な形状）
  if (aspectRatio < 0.5 || aspectRatio > 2.0) {
    return false; // アスペクト比が極端
  }
  
  // 角度をチェック（4つの角がほぼ90度に近いか）
  for (let i = 0; i < 4; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % 4];
    const p3 = points[(i + 2) % 4];
    
    // ベクトルを計算
    const v1x = p2.x - p1.x;
    const v1y = p2.y - p1.y;
    const v2x = p3.x - p2.x;
    const v2y = p3.y - p2.y;
    
    // 内積から角度を計算
    const dot = v1x * v2x + v1y * v2y;
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
    const cosAngle = dot / (len1 * len2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
    
    // 角度が70度～110度の範囲内（90度±20度）
    if (angle < 70 || angle > 110) {
      return false; // 角度が90度から大きく外れている
    }
  }
  
  return true; // すべてのチェックを通過
}

export function useTarotReader(): UseTarotReaderReturn {
  const [isCvLoaded, setIsCvLoaded] = useState(false);
  const [isMasterReady, setIsMasterReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasSavedImage, setHasSavedImage] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [detectedRect, setDetectedRect] = useState<DetectedRect | null>(null);
  const [detectedRectImage, setDetectedRectImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const savedImageRef = useRef<string | null>(null);
  const savedImageElementRef = useRef<HTMLImageElement | null>(null);
  // Map構造で特徴量をキャッシュ
  const masterDataMapRef = useRef<Map<string, MasterData>>(new Map());
  // 矩形検出の安定性を追跡（自動撮影の準備）
  const rectDetectionCountRef = useRef<number>(0);
  // カメラストリームを保持
  const cameraStreamRef = useRef<MediaStream | null>(null);
  // 最後に矩形が検出された時刻を記録（一定時間有効化のため）
  const lastDetectionTimeRef = useRef<number | null>(null);
  // タイマーIDを保持
  const detectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // OpenCV.jsのロード
  useEffect(() => {
    // 既にロード済みかチェック
    if (window.cv) {
      setIsCvLoaded(true);
      console.log('OpenCV.js Ready');
      return;
    }

    // ScriptタグでOpenCV.jsをロード
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.x/opencv.js';
    script.async = true;
    script.onload = () => {
      console.log('[OpenCV.js] スクリプトロード完了');
      // OpenCV.jsの初期化を待つ
      if (window.cv) {
        console.log('[OpenCV.js] window.cvが存在します');
        if (window.cv.onRuntimeInitialized) {
          console.log('[OpenCV.js] 初期化を待機中...');
          window.cv.onRuntimeInitialized = () => {
            setIsCvLoaded(true);
            console.log('[OpenCV.js] 初期化完了 - 準備完了');
          };
        } else {
          // 既に初期化済みの場合
          console.log('[OpenCV.js] 既に初期化済みと判断');
          setIsCvLoaded(true);
          console.log('[OpenCV.js] 既に初期化済み');
        }
      } else {
        console.error('[OpenCV.js] window.cvが存在しません');
      }
    };
    
    script.onerror = () => {
      console.error('[OpenCV.js] スクリプトのロードに失敗しました');
    };
    document.body.appendChild(script);

    return () => {
      // クリーンアップ
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // ORB作成ヘルパー関数
  const createORB = useCallback((maxFeatures: number = 500) => {
    const cv = window.cv;
    if (cv.ORB_create) {
      return cv.ORB_create(maxFeatures);
    } else if (cv.ORB && typeof cv.ORB === 'function') {
      return new cv.ORB(maxFeatures);
    } else if (cv.ORB && cv.ORB.create) {
      return cv.ORB.create(maxFeatures);
    } else {
      throw new Error('ORB is not available in this OpenCV.js build. Make sure features2d module is included.');
    }
  }, []);

  // BFMatcher作成ヘルパー関数
  const createBFMatcher = useCallback((normType: number, crossCheck: boolean = false) => {
    const cv = window.cv;
    if (cv.BFMatcher_create) {
      return cv.BFMatcher_create(normType, crossCheck);
    } else if (cv.BFMatcher && typeof cv.BFMatcher === 'function') {
      return new cv.BFMatcher(normType, crossCheck);
    } else if (cv.BFMatcher && cv.BFMatcher.create) {
      return cv.BFMatcher.create(normType, crossCheck);
    } else {
      throw new Error('BFMatcher is not available in this OpenCV.js build. Make sure features2d module is included.');
    }
  }, []);

  // マスターデータのロードとORB特徴量計算（フォルダベースの複数画像ロード）
  useEffect(() => {
    if (!isCvLoaded) return;

    // 1つのマスター画像をロードして特徴量を計算
    const loadMasterImage = async (cardName: string, imagePath: string): Promise<MasterImageData | null> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const src = window.cv.imread(img);
            const gray = new window.cv.Mat();
            window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

            const orb = createORB(500);
            const keypoints = new window.cv.KeyPointVector();
            const descriptors = new window.cv.Mat();

            orb.detectAndCompute(gray, new window.cv.Mat(), keypoints, descriptors);

            // メモリ解放（keypointsとdescriptorsは保持するため削除しない）
            src.delete();
            gray.delete();
            orb.delete();

            resolve({
              keypoints,
              descriptors,
            });
          } catch (error) {
            console.error(`✗ ${cardName}の画像(${imagePath})の特徴量計算エラー:`, error);
            resolve(null);
          }
        };
        img.onerror = () => {
          console.warn(`✗ ${cardName}の画像が見つかりません: ${imagePath} (スキップします)`);
          resolve(null);
        };
        img.src = imagePath;
      });
    };

    // 1つのカードの全画像をロード
    const loadCardImages = async (cardName: string, imageFiles: string[]): Promise<MasterImageData[]> => {
      const loadPromises = imageFiles.map((imageFile) =>
        loadMasterImage(cardName, `/master/${cardName}/${imageFile}`)
      );
      const results = await Promise.all(loadPromises);
      return results.filter((r): r is MasterImageData => r !== null);
    };

    const initializeMasterData = async () => {
      console.log('マスターデータの初期化を開始...');
      console.log('Preparing Database...');

      try {
        // master-list.json を読み込む
        const response = await fetch('/lib/master-list.json');
        if (!response.ok) {
          throw new Error(`master-list.json の読み込みに失敗しました: ${response.status}`);
        }
        const masterList: Record<string, string[]> = await response.json();

        console.log(`マスターリストを読み込みました: ${Object.keys(masterList).length} 枚のカード`);

        // 各カードの全画像をロード
        const cardNames = Object.keys(masterList);
        const cardLoadPromises = cardNames.map(async (cardName) => {
          const imageFiles = masterList[cardName];
          const imageDataArray = await loadCardImages(cardName, imageFiles);

          if (imageDataArray.length > 0) {
            const displayName = CARD_DISPLAY_NAMES[cardName] || cardName;
            masterDataMapRef.current.set(cardName, {
              images: imageDataArray,
              displayName,
            });

            const totalKeypoints = imageDataArray.reduce((sum, img) => sum + img.keypoints.size(), 0);
            console.log(`✓ ${displayName} (${cardName}): ${imageDataArray.length} 枚の画像、合計 ${totalKeypoints} 個の特徴点`);
            return true;
          } else {
            console.warn(`⚠ ${cardName}: 有効な画像が1枚も見つかりませんでした`);
            return false;
          }
        });

        const results = await Promise.all(cardLoadPromises);
        const successCount = results.filter((r) => r).length;
        const totalCount = cardNames.length;

        console.log(`マスターデータの初期化が完了しました: ${successCount}/${totalCount} 枚のカードをロード`);
        
        if (successCount > 0) {
          setIsMasterReady(true);
          console.log(`利用可能なカード: ${Array.from(masterDataMapRef.current.keys()).join(', ')}`);
        } else {
          console.error('マスターデータが1枚もロードできませんでした');
        }
      } catch (error) {
        console.error('マスターデータの初期化エラー:', error);
      }
    };

    initializeMasterData();
  }, [isCvLoaded, createORB]);

  // 保存済み画像の復元
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      savedImageRef.current = saved;
      setHasSavedImage(true);
      // 復元時は解析を実行しない（ユーザーが再撮影するまで待つ）
    }
  }, []);

  // 保存済み画像のロード
  useEffect(() => {
    if (hasSavedImage && savedImageRef.current && !savedImageElementRef.current) {
      const img = new Image();
      img.onload = () => {
        savedImageElementRef.current = img;
      };
      img.src = savedImageRef.current;
    } else if (!hasSavedImage) {
      savedImageElementRef.current = null;
    }
  }, [hasSavedImage]);

  // 描画ループ
  const drawLoop = useCallback(() => {
    if (!canvasRef.current || !isCvLoaded) {
      animationFrameRef.current = requestAnimationFrame(drawLoop);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(drawLoop);
      return;
    }

    // OpenCVが利用可能か確認
    if (!window.cv || !window.cv.Canny || !window.cv.findContours) {
      // 初回のみ警告を出力（ログが多すぎるのを防ぐ）
      if (Math.random() < 0.01) {
        console.warn('[描画ループ] OpenCVが利用できません');
      }
      animationFrameRef.current = requestAnimationFrame(drawLoop);
      return;
    }

    if (hasSavedImage && savedImageElementRef.current) {
      // 保存済み画像を表示
      const img = savedImageElementRef.current;
      if (img.complete) {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // ダミーOCR解析（ループ実行）
        // 実際のOCR処理はここに実装
      }
    } else if (videoRef.current && videoRef.current.readyState === 4) {
      // ライブプレビュー（フィルタ適用）
      const video = videoRef.current;
      
      // video要素が設定されていて、ストリームが保持されている場合は設定
      if (cameraStreamRef.current && !video.srcObject) {
        video.srcObject = cameraStreamRef.current;
      }
      
      // ストリームが設定されているが再生されていない場合は再生を開始
      if (video.srcObject && video.paused && video.readyState >= 2) {
        video.play().catch((error) => {
          console.warn('[カメラ] 再生エラー:', error);
        });
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // デバッグ: 描画ループが動作していることを確認（初回のみ）
      if (Math.random() < 0.001) {
        console.log('[描画ループ] 動作中...', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
        });
      }

      try {
        // OpenCVでフィルタ処理
        if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
          // ビデオが準備できていない場合は通常描画
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          animationFrameRef.current = requestAnimationFrame(drawLoop);
          return;
        }
        
        // デバッグ: 処理開始（50フレームに1回程度）
        const shouldDebug = Math.random() < 0.02;
        if (shouldDebug) {
          console.log('[描画] OpenCV処理開始');
        }
        
        // ビデオ要素を一度Canvasに描画してから読み込む（imreadがビデオ要素を直接認識できないため）
        // 一時的なCanvasに描画
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          animationFrameRef.current = requestAnimationFrame(drawLoop);
          return;
        }
        tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        
        let src: any;
        try {
          src = window.cv.imread(tempCanvas);
          if (shouldDebug) {
            console.log('[描画] imread実行完了', { src: src ? '存在' : 'null', empty: src?.empty() });
          }
        } catch (imreadError) {
          if (shouldDebug) {
            console.error('[描画] imreadエラー:', imreadError);
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          animationFrameRef.current = requestAnimationFrame(drawLoop);
          return;
        }
        
        if (!src || src.empty()) {
          if (shouldDebug) {
            console.warn('[描画] 画像の読み込みに失敗しました', { src: src ? '存在' : 'null', empty: src?.empty() });
          }
          src?.delete();
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          animationFrameRef.current = requestAnimationFrame(drawLoop);
          return;
        }
        
        if (shouldDebug) {
          console.log('[描画] 画像読み込み成功', { rows: src.rows, cols: src.cols });
        }
        
        const gray = new window.cv.Mat();
        
        // グレースケール変換
        window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
        
        if (shouldDebug) {
          console.log('[描画] グレースケール変換完了');
        }
        
        // 高コントラスト処理（コントラスト調整）
        const contrast = new window.cv.Mat();
        const alpha = 1.5; // コントラスト係数
        const beta = 0; // 明るさ調整
        gray.convertTo(contrast, -1, alpha, beta);
        
        if (shouldDebug) {
          console.log('[描画] コントラスト調整完了');
        }
        
        // Canvasに描画（グレースケールをRGBAに変換してから描画）
        // グレースケール画像をRGBAに変換
        const rgba = new window.cv.Mat();
        window.cv.cvtColor(contrast, rgba, window.cv.COLOR_GRAY2RGBA);
        
        if (shouldDebug) {
          console.log('[描画] RGBA変換完了');
        }
        
        // Canvasに描画（imshowの代わりに、ImageDataを使用）
        const imgData = new ImageData(
          new Uint8ClampedArray(rgba.data),
          rgba.cols,
          rgba.rows
        );
        ctx.putImageData(imgData, 0, 0);
        
        if (shouldDebug) {
          console.log('[描画] Canvas描画完了、輪郭検出に進みます');
        }
        
        // メモリ解放
        rgba.delete();
        
        // 輪郭検出処理（カードの矩形を検出）
        let detectedRectData: DetectedRect | null = null;
        
        // デバッグ: 輪郭検出処理の開始を確認
        if (shouldDebug) {
          console.log('[輪郭検出] 処理開始', {
            hasCanny: !!window.cv.Canny,
            hasFindContours: !!window.cv.findContours,
            contrastRows: contrast.rows,
            contrastCols: contrast.cols,
          });
        }
        
        try {
          // Cannyエッジ検出
          const edges = new window.cv.Mat();
          window.cv.Canny(contrast, edges, 50, 150, 3, false);
          
          // 膨張処理（dilate）でエッジを太くし、カードの輪郭を明確にする
          const dilated = new window.cv.Mat();
          const kernelSize = new window.cv.Size(3, 3);
          const kernel = window.cv.getStructuringElement(window.cv.MORPH_RECT, kernelSize);
          const anchor = new window.cv.Point(-1, -1);
          window.cv.dilate(edges, dilated, kernel, anchor, 2, window.cv.BORDER_CONSTANT, window.cv.morphologyDefaultBorderValue());
          
          // デバッグ: Canny処理が完了したことを確認（50フレームに1回程度）
          if (Math.random() < 0.02) {
            console.log('[輪郭検出] Canny処理完了', {
              edgesRows: edges.rows,
              edgesCols: edges.cols,
            });
          }
          
          // 輪郭を検出（膨張処理後の画像を使用）
          // OpenCV.jsでは MatVector を使用
          const contours = new window.cv.MatVector();
          const hierarchy = new window.cv.Mat();
          window.cv.findContours(
            dilated,
            contours,
            hierarchy,
            window.cv.RETR_EXTERNAL,
            window.cv.CHAIN_APPROX_SIMPLE
          );
          
          // メモリ解放（後で行う）
          
          // デバッグ: 輪郭検出処理が実行されていることを確認（100フレームに1回程度）
          if (Math.random() < 0.01) {
            console.log('[輪郭検出] 処理実行中...');
          }
          
          const totalContours = contours.size();
          let maxArea = 0;
          let largestContour: any = null;
          const areaList: number[] = [];
          let allMaxArea = 0; // 最小面積に関係なく最大の面積
          
          // ログ出力（検出時は常に、それ以外は50フレームに1回程度に変更）
          const shouldLog = totalContours > 0 || Math.random() < 0.02;
          
          // 最大の輪郭を探す（すべての輪郭の面積を記録）
          for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = window.cv.contourArea(contour, false);
            areaList.push(area);
            
            // すべての輪郭の中で最大の面積を記録
            if (area > allMaxArea) {
              allMaxArea = area;
            }
          }
          
          // 動的な最小面積を計算（最大面積の50%以上、または絶対値で500以上）
          const minArea = Math.max(500, allMaxArea * 0.5);
          
          if (shouldLog) {
            console.log(`[輪郭検出] 検出された輪郭数: ${totalContours}, 最小面積: ${minArea.toFixed(0)}, Canvasサイズ: ${canvas.width}x${canvas.height}`);
          }
          
          // 最小面積を満たす最大の輪郭を探す
          for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = areaList[i];
            
            if (area > maxArea && area >= minArea) {
              maxArea = area;
              largestContour = contour;
            }
          }
          
          // デバッグ: 面積の分布を確認（常に出力）
          if (shouldLog && areaList.length > 0) {
            const sortedAreas = [...areaList].sort((a, b) => b - a);
            console.log(`[輪郭検出] 面積の分布（上位5件）:`, sortedAreas.slice(0, 5).map(a => a.toFixed(0)).join(', '), `最大面積: ${allMaxArea.toFixed(0)}, 最小面積閾値: ${minArea.toFixed(0)}`);
          }
          
          // 最大の輪郭が見つかった場合、矩形に近似
          if (largestContour) {
            console.log(`[輪郭検出] 最大輪郭を検出: 面積 ${maxArea.toFixed(0)} (最小面積: ${minArea.toFixed(0)})`);
            
            // approxPolyDPの出力はMat型
            const approx = new window.cv.Mat();
            // 参考コードに合わせてepsilonを0.01に設定（より厳密な近似）
            const epsilon = 0.01 * window.cv.arcLength(largestContour, true);
            window.cv.approxPolyDP(largestContour, approx, epsilon, true);
            
            // Matから頂点数を取得（Matのrowsが頂点数）
            const approxSize = approx.rows;
            console.log(`[輪郭検出] 近似後の頂点数: ${approxSize}, epsilon: ${epsilon.toFixed(1)}`);
            
            // 頂点が4つの場合のみ矩形として扱う（参考コードに合わせて厳密に）
            if (approxSize === 4) {
              const points: Array<{ x: number; y: number }> = [];
              // Matから頂点を取得（各頂点はMatの行として格納されている）
              // Matのデータは32bit signed integer配列としてアクセス可能
              const data = approx.data32S; // または data32F (float)
              
              // 4つの頂点を取得
              for (let i = 0; i < 4; i++) {
                const x = data[i * 2];
                const y = data[i * 2 + 1];
                points.push({ x, y });
              }
              
              // 矩形の形状チェック（カードの形状に近いか確認）
              const isValidRectangle = checkRectangleShape(points);
              
              // 矩形の4点を左上、右上、右下、左下の順に並べ替え
              if (isValidRectangle) {
                const sortedPoints = sortRectanglePoints(points);
                points.length = 0;
                points.push(...sortedPoints);
              }
              
              if (isValidRectangle) {
                detectedRectData = {
                  points,
                  area: maxArea,
                };
                
                // 矩形検出の安定性を追跡
                rectDetectionCountRef.current += 1;
                
                // 矩形領域の画像を切り出して保存
                const xs = points.map(p => p.x);
                const ys = points.map(p => p.y);
                const minX = Math.max(0, Math.floor(Math.min(...xs)));
                const minY = Math.max(0, Math.floor(Math.min(...ys)));
                const maxX = Math.min(canvas.width, Math.ceil(Math.max(...xs)));
                const maxY = Math.min(canvas.height, Math.ceil(Math.max(...ys)));
                const width = maxX - minX;
                const height = maxY - minY;
                
                // 切り出し用の一時Canvasを作成
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = width;
                cropCanvas.height = height;
                const cropCtx = cropCanvas.getContext('2d');
                
                if (cropCtx && width > 0 && height > 0) {
                  // 元のCanvasから領域を切り出し
                  cropCtx.drawImage(
                    canvas,
                    minX, minY, width, height,
                    0, 0, width, height
                  );
                  const croppedImageData = cropCanvas.toDataURL('image/png');
                  setDetectedRectImage(croppedImageData);
                  
                  // 最後に検出された時刻を更新
                  lastDetectionTimeRef.current = Date.now();
                  
                  // 既存のタイマーをクリア
                  if (detectionTimeoutRef.current) {
                    clearTimeout(detectionTimeoutRef.current);
                  }
                  
                  // 一定時間（1秒）後に画像を無効化するタイマーを設定
                  detectionTimeoutRef.current = setTimeout(() => {
                    setDetectedRectImage(null);
                    lastDetectionTimeRef.current = null;
                    detectionTimeoutRef.current = null;
                    console.log('[矩形検出] 一定時間検出されなかったため、画像を無効化しました');
                  }, 1000); // 1秒
                  
                  console.log(`[矩形検出成功] 頂点:`, points, `面積: ${maxArea.toFixed(0)}, 連続検出: ${rectDetectionCountRef.current}回, 切り出し画像: ${width}x${height}`);
                } else {
                  console.warn('[矩形検出] 領域画像の切り出しに失敗しました');
                }
              } else {
                console.log(`[矩形検出失敗] 形状チェックに失敗: 頂点数は4つだが、矩形の形状ではない`);
              }
              
              // 矩形をCanvas上に緑色の枠線で描画
              ctx.strokeStyle = '#00ff00';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(points[0].x, points[0].y);
              for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
              }
              ctx.closePath();
              ctx.stroke();
            } else {
              console.log(`[矩形検出失敗] 頂点数が4つではありません: ${approxSize}`);
              rectDetectionCountRef.current = 0;
            }
            
            approx.delete();
          } else {
            if (totalContours > 0) {
              console.log(`[矩形検出失敗] 最小面積を満たす輪郭が見つかりませんでした`);
            }
            rectDetectionCountRef.current = 0;
            // 矩形が検出されなかった場合でも、一定時間内であれば画像を保持
            // （タイマーは既に設定されているため、そのまま維持）
          }
          
          // メモリ解放
          edges.delete();
          dilated.delete();
          kernel.delete();
          contours.delete();
          hierarchy.delete();
        } catch (contourError) {
          // 輪郭検出エラーは無視（処理を続行）
          // エラーログは常に出力（問題の特定のため）
          if (contourError instanceof Error) {
            console.error('[輪郭検出エラー]', contourError.message, contourError.stack);
          } else {
            console.error('[輪郭検出エラー]', contourError);
          }
          rectDetectionCountRef.current = 0;
        }
        
        // detectedRectステートを更新
        setDetectedRect(detectedRectData);
        
        // 矩形が検出されなかった場合でも、一定時間内であれば画像を保持
        // （タイマーで自動的にクリアされるため、ここでは何もしない）
        
        // メモリ解放
        src.delete();
        gray.delete();
        contrast.delete();
      } catch (error) {
        // OpenCV処理が失敗した場合は通常描画
        // エラーログは常に出力（問題の特定のため）
        if (error instanceof Error) {
          // "Please input the valid canvas or img id" エラーは無視（imshow関連のエラー）
          if (!error.message.includes('canvas or img id')) {
            console.warn('[描画エラー]', error.message, error.stack);
          }
        } else {
          console.warn('[描画エラー]', error);
        }
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch (drawError) {
          console.error('[Canvas描画エラー]', drawError);
        }
        setDetectedRect(null);
        rectDetectionCountRef.current = 0;
      }
    }

    animationFrameRef.current = requestAnimationFrame(drawLoop);
  }, [isCvLoaded, hasSavedImage]);

  // 描画ループの開始/停止
  useEffect(() => {
    if (isCvLoaded) {
      drawLoop();
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCvLoaded, drawLoop]);

  // カメラストリームの開始
  useEffect(() => {
    if (!hasSavedImage) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          cameraStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((error) => {
          console.error('カメラアクセスエラー:', error);
        });
    } else {
      // 画像保存時はストリームを停止
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    }

    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [hasSavedImage]);

  // 画像マッチング処理（フォルダ内全画像と比較し、最高スコアを採用）
  const performMatching = useCallback(async (imageElement: HTMLImageElement | HTMLCanvasElement) => {
    if (!isCvLoaded || masterDataMapRef.current.size === 0) {
      console.warn('OpenCVがロードされていないか、マスターデータが初期化されていません');
      return;
    }

    setIsAnalyzing(true);

    let src: any = null;
    let gray: any = null;
    let orb: any = null;
    let keypoints: any = null;
    let descriptors: any = null;
    let matcher: any = null;

    try {
      // 撮影画像の特徴量を抽出
      src = window.cv.imread(imageElement);
      gray = new window.cv.Mat();
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

      orb = createORB(500);
      keypoints = new window.cv.KeyPointVector();
      descriptors = new window.cv.Mat();

      orb.detectAndCompute(gray, new window.cv.Mat(), keypoints, descriptors);

      // BFMatcherでマッチング
      matcher = createBFMatcher(window.cv.NORM_HAMMING, false);
      const matchResults: Map<string, number> = new Map();

      // すべてのマスターデータと比較
      for (const [cardName, master] of masterDataMapRef.current.entries()) {
        let maxScore = 0; // このカードフォルダ内での最高スコア

        // このカードの全マスター画像と比較
        for (let imgIndex = 0; imgIndex < master.images.length; imgIndex++) {
          const masterImage = master.images[imgIndex];
          const matches = new window.cv.DMatchVector();
          matcher.match(descriptors, masterImage.descriptors, matches);

          // Good Matchesを計算（距離が小さいものを厳格にフィルタリング）
          const goodMatches: any[] = [];
          const matchCount = matches.size();
          
          // 距離の最小値を計算（より厳格なフィルタリングのため）
          let minDistance = Infinity;
          for (let i = 0; i < matchCount; i++) {
            const match = matches.get(i);
            if (match.distance < minDistance) {
              minDistance = match.distance;
            }
          }

          // Good Matches: 最小距離の2倍以下（Lowe's ratio testの簡易版）
          const threshold = Math.max(30, minDistance * 2);
          for (let i = 0; i < matchCount; i++) {
            const match = matches.get(i);
            if (match.distance < threshold) {
              goodMatches.push(match);
            }
          }

          const goodMatchCount = goodMatches.length;
          
          // この画像とのスコアが最高スコアを上回る場合は更新
          if (goodMatchCount > maxScore) {
            maxScore = goodMatchCount;
          }

          matches.delete();
        }

        // このカードの最終スコアとして最高スコアを採用
        matchResults.set(cardName, maxScore);
        console.log(`${master.displayName} (${cardName}): 最高スコア ${maxScore} matches (${master.images.length} 枚の画像と比較)`);
      }

      // スコアが高い順にソートしてCandidate配列に変換
      const sortedCandidates: Candidate[] = Array.from(matchResults.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([cardName, matchCount]) => {
          const master = masterDataMapRef.current.get(cardName);
          return {
            cardName: master?.displayName || cardName,
            matchCount,
          };
        });

      console.log('マッチング結果:', Array.from(matchResults.entries()).map(([name, count]) => {
        const master = masterDataMapRef.current.get(name);
        return `${master?.displayName || name}: ${count}`;
      }).join(', '));
      console.log('候補順位:', sortedCandidates.map(c => `${c.cardName}: ${c.matchCount} matches`));

      setCandidates(sortedCandidates);
    } catch (error) {
      console.error('マッチング処理エラー:', error);
      setCandidates([]);
    } finally {
      // メモリ解放（エラーが発生しても確実に解放）
      if (src) src.delete();
      if (gray) gray.delete();
      if (orb) orb.delete();
      if (keypoints) keypoints.delete();
      if (descriptors) descriptors.delete();
      if (matcher) matcher.delete();
      setIsAnalyzing(false);
    }
  }, [isCvLoaded, createORB, createBFMatcher]);

  // 画像を撮影（小窓の画像をそのまま使用）
  const captureImage = useCallback(() => {
    if (!canvasRef.current || !videoRef.current || !isCvLoaded) return;

    const canvas = canvasRef.current;
    let imageData: string;

    // 小窓に表示されている画像（detectedRectImage）がある場合はそれを使用
    if (detectedRectImage) {
      imageData = detectedRectImage;
      console.log('[撮影] 小窓の画像をそのまま使用します');
    } else {
      // 矩形が検出されていない場合は、現在のCanvas全体を使用
      imageData = canvas.toDataURL('image/png');
      console.log('[撮影] 矩形が検出されていないため、全体画像を使用します');
    }
    
    // localStorageに保存
    localStorage.setItem(STORAGE_KEY, imageData);
    savedImageRef.current = imageData;
    
    // 状態更新
    setHasSavedImage(true);
    
    // カメラストリームを停止
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }

    // 画像をロードしてマッチング処理を実行
    const img = new Image();
    img.onload = () => {
      performMatching(img);
    };
    img.src = imageData;
  }, [isCvLoaded, performMatching, detectedRectImage]);

  // 画像を削除
  const deleteImage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    savedImageRef.current = null;
    savedImageElementRef.current = null;
    setHasSavedImage(false);
    setCandidates([]);
    setBlacklist([]);
    setDetectedRectImage(null);
    
    // タイマーもクリア
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
      detectionTimeoutRef.current = null;
    }
    lastDetectionTimeRef.current = null;
  }, []);

  // ブラックリストに追加
  const addToBlacklist = useCallback((card: string) => {
    setBlacklist((prev) => [...prev, card]);
  }, []);

  // メモリ解放の自動化（クリーンアップ処理）
  useEffect(() => {
    return () => {
      // タイマーをクリア
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
        detectionTimeoutRef.current = null;
      }
      
      // ページを離れる際や再読み込み時に、Map内のcv.Matオブジェクトをすべて削除
      console.log('マスターデータのメモリを解放中...');
      const masterDataMap = masterDataMapRef.current;
      for (const [cardId, masterData] of masterDataMap.entries()) {
        try {
          // 各カードの全画像の特徴量を解放
          for (const imageData of masterData.images) {
            if (imageData.keypoints) {
              imageData.keypoints.delete();
            }
            if (imageData.descriptors) {
              imageData.descriptors.delete();
            }
          }
        } catch (error) {
          console.warn(`${cardId}のメモリ解放エラー:`, error);
        }
      }
      masterDataMap.clear();
      console.log('マスターデータのメモリ解放が完了しました');
    };
  }, []);

  // フィルタリングされた候補
  const filteredCandidates = candidates.filter((c) => !blacklist.includes(c.cardName));

  return {
    isCvLoaded,
    isMasterReady,
    isAnalyzing,
    hasSavedImage,
    candidates: filteredCandidates,
    blacklist,
    detectedRect,
    detectedRectImage,
    videoRef,
    canvasRef,
    captureImage,
    deleteImage,
    addToBlacklist,
  };
}

