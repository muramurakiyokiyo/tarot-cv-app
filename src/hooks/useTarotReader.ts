'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface MasterData {
  keypoints: any;
  descriptors: any;
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
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  captureImage: () => void;
  deleteImage: () => void;
  addToBlacklist: (card: string) => void;
}

const STORAGE_KEY = 'tarot-captured-image';

// 大アルカナ22枚のIDリスト
const MAJOR_ARCANA_IDS = [
  'FOOL',
  'MAGICIAN',
  'HIGHPRIESTESS',
  'EMPRESS',
  'EMPEROR',
  'HIEROPHANT',
  'LOVERS',
  'CHARIOT',
  'STRENGTH',
  'HERMIT',
  'WHEELOFFORTUNE',
  'JUSTICE',
  'HANGEDMAN',
  'DEATH',
  'TEMPERANCE',
  'DEVIL',
  'TOWER',
  'STAR',
  'MOON',
  'SUN',
  'JUDGEMENT',
  'WORLD',
] as const;

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

export function useTarotReader(): UseTarotReaderReturn {
  const [isCvLoaded, setIsCvLoaded] = useState(false);
  const [isMasterReady, setIsMasterReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasSavedImage, setHasSavedImage] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [detectedRect, setDetectedRect] = useState<DetectedRect | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const savedImageRef = useRef<string | null>(null);
  const savedImageElementRef = useRef<HTMLImageElement | null>(null);
  // Map構造で特徴量をキャッシュ
  const masterDataMapRef = useRef<Map<string, MasterData>>(new Map());
  // 矩形検出の安定性を追跡（自動撮影の準備）
  const rectDetectionCountRef = useRef<number>(0);

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
      // OpenCV.jsの初期化を待つ
      window.cv.onRuntimeInitialized = () => {
        setIsCvLoaded(true);
        console.log('OpenCV.js Ready');
      };
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

  // マスターデータのロードとORB特徴量計算（動的ロード）
  useEffect(() => {
    if (!isCvLoaded) return;

    const loadMasterData = async (cardId: string, imagePath: string): Promise<boolean> => {
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

            const cardName = CARD_DISPLAY_NAMES[cardId] || cardId;
            masterDataMapRef.current.set(cardId, {
              keypoints,
              descriptors,
            });

            console.log(`✓ ${cardName} (${cardId}): 特徴点 ${keypoints.size()} 個、記述子サイズ ${descriptors.rows}x${descriptors.cols}`);

            // メモリ解放（keypointsとdescriptorsは保持するため削除しない）
            src.delete();
            gray.delete();
            orb.delete();

            resolve(true);
          } catch (error) {
            console.error(`✗ ${cardId}の特徴量計算エラー:`, error);
            resolve(false);
          }
        };
        img.onerror = () => {
          console.warn(`✗ ${cardId}の画像が見つかりません: ${imagePath} (スキップします)`);
          resolve(false);
        };
        img.src = imagePath;
      });
    };

    const initializeMasterData = async () => {
      console.log('マスターデータの初期化を開始...');
      const loadPromises = MAJOR_ARCANA_IDS.map((cardId) =>
        loadMasterData(cardId, `/master/${cardId}.jpg`)
      );

      const results = await Promise.all(loadPromises);
      const successCount = results.filter((r) => r).length;
      const totalCount = MAJOR_ARCANA_IDS.length;

      console.log(`マスターデータの初期化が完了しました: ${successCount}/${totalCount} 枚のカードをロード`);
      
      if (successCount > 0) {
        setIsMasterReady(true);
        console.log(`利用可能なカード: ${Array.from(masterDataMapRef.current.keys()).join(', ')}`);
      } else {
        console.error('マスターデータが1枚もロードできませんでした');
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
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      try {
        // OpenCVでフィルタ処理
        const src = window.cv.imread(video);
        const gray = new window.cv.Mat();
        
        // グレースケール変換
        window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
        
        // 高コントラスト処理（コントラスト調整）
        const contrast = new window.cv.Mat();
        const alpha = 1.5; // コントラスト係数
        const beta = 0; // 明るさ調整
        gray.convertTo(contrast, -1, alpha, beta);
        
        // Canvasに描画
        window.cv.imshow(canvas, contrast);
        
        // 輪郭検出処理（カードの矩形を検出）
        let detectedRectData: DetectedRect | null = null;
        try {
          // Cannyエッジ検出
          const edges = new window.cv.Mat();
          window.cv.Canny(contrast, edges, 50, 150, 3, false);
          
          // 輪郭を検出
          const contours = new window.cv.ContourVector();
          const hierarchy = new window.cv.Mat();
          window.cv.findContours(
            edges,
            contours,
            hierarchy,
            window.cv.RETR_EXTERNAL,
            window.cv.CHAIN_APPROX_SIMPLE
          );
          
          // 画像全体の面積の10%以上を最小面積として設定
          const minArea = (canvas.width * canvas.height) * 0.1;
          let maxArea = 0;
          let largestContour: any = null;
          
          // 最大の輪郭を探す
          for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = window.cv.contourArea(contour, false);
            
            if (area > maxArea && area >= minArea) {
              maxArea = area;
              largestContour = contour;
            }
          }
          
          // 最大の輪郭が見つかった場合、矩形に近似
          if (largestContour) {
            const approx = new window.cv.PointVector();
            const epsilon = 0.02 * window.cv.arcLength(largestContour, true);
            window.cv.approxPolyDP(largestContour, approx, epsilon, true);
            
            // 頂点が4つの矩形を探す
            if (approx.size() === 4) {
              const points: Array<{ x: number; y: number }> = [];
              for (let i = 0; i < 4; i++) {
                const point = approx.get(i);
                points.push({ x: point.x, y: point.y });
              }
              
              detectedRectData = {
                points,
                area: maxArea,
              };
              
              // 矩形検出の安定性を追跡
              rectDetectionCountRef.current += 1;
              
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
              rectDetectionCountRef.current = 0;
            }
            
            approx.delete();
          } else {
            rectDetectionCountRef.current = 0;
          }
          
          // メモリ解放
          edges.delete();
          contours.delete();
          hierarchy.delete();
        } catch (contourError) {
          // 輪郭検出エラーは無視（処理を続行）
          console.warn('輪郭検出エラー:', contourError);
          rectDetectionCountRef.current = 0;
        }
        
        // detectedRectステートを更新
        setDetectedRect(detectedRectData);
        
        // メモリ解放
        src.delete();
        gray.delete();
        contrast.delete();
      } catch {
        // OpenCV処理が失敗した場合は通常描画
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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
    if (!hasSavedImage && videoRef.current) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((error) => {
          console.error('カメラアクセスエラー:', error);
        });
    }

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [hasSavedImage]);

  // 画像マッチング処理
  const performMatching = useCallback(async (imageElement: HTMLImageElement | HTMLCanvasElement) => {
    if (!isCvLoaded || masterDataMapRef.current.size === 0) {
      console.warn('OpenCVがロードされていないか、マスターデータが初期化されていません');
      return;
    }

    setIsAnalyzing(true);

    try {
      // 撮影画像の特徴量を抽出
      const src = window.cv.imread(imageElement);
      const gray = new window.cv.Mat();
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

      const orb = createORB(500);
      const keypoints = new window.cv.KeyPointVector();
      const descriptors = new window.cv.Mat();

      orb.detectAndCompute(gray, new window.cv.Mat(), keypoints, descriptors);

      // BFMatcherでマッチング
      const matcher = createBFMatcher(window.cv.NORM_HAMMING, false);
      const matchResults: Map<string, number> = new Map();

      // すべてのマスターデータと比較
      for (const [cardId, master] of masterDataMapRef.current.entries()) {
        const matches = new window.cv.DMatchVector();
        matcher.match(descriptors, master.descriptors, matches);

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
        const cardName = CARD_DISPLAY_NAMES[cardId] || cardId;
        matchResults.set(cardId, goodMatchCount);
        
        console.log(`${cardName} (${cardId}): 総マッチ数 ${matchCount}, Good Matches ${goodMatchCount} (閾値: ${threshold.toFixed(1)})`);

        matches.delete();
      }

      // スコアが高い順にソートしてCandidate配列に変換
      const sortedCandidates: Candidate[] = Array.from(matchResults.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([cardId, matchCount]) => ({
          cardName: CARD_DISPLAY_NAMES[cardId] || cardId,
          matchCount,
        }));

      console.log('マッチング結果:', Array.from(matchResults.entries()).map(([id, count]) => `${CARD_DISPLAY_NAMES[id] || id}: ${count}`).join(', '));
      console.log('候補順位:', sortedCandidates.map(c => `${c.cardName}: ${c.matchCount} matches`));

      setCandidates(sortedCandidates);

      // メモリ解放
      src.delete();
      gray.delete();
      orb.delete();
      keypoints.delete();
      descriptors.delete();
      matcher.delete();
    } catch (error) {
      console.error('マッチング処理エラー:', error);
      setCandidates([]);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isCvLoaded, createORB, createBFMatcher]);

  // 画像を撮影
  const captureImage = useCallback(() => {
    if (!canvasRef.current || !videoRef.current || !isCvLoaded) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    // 現在のCanvasの内容（フィルタ適用済み）を取得
    const imageData = canvas.toDataURL('image/png');
    
    // localStorageに保存
    localStorage.setItem(STORAGE_KEY, imageData);
    savedImageRef.current = imageData;
    
    // 状態更新
    setHasSavedImage(true);
    
    // カメラストリームを停止
    if (video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }

    // 画像をロードしてマッチング処理を実行
    const img = new Image();
    img.onload = () => {
      performMatching(img);
    };
    img.src = imageData;
  }, [isCvLoaded, performMatching]);

  // 画像を削除
  const deleteImage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    savedImageRef.current = null;
    savedImageElementRef.current = null;
    setHasSavedImage(false);
    setCandidates([]);
    setBlacklist([]);
  }, []);

  // ブラックリストに追加
  const addToBlacklist = useCallback((card: string) => {
    setBlacklist((prev) => [...prev, card]);
  }, []);

  // メモリ解放の自動化（クリーンアップ処理）
  useEffect(() => {
    return () => {
      // ページを離れる際や再読み込み時に、Map内のcv.Matオブジェクトをすべて削除
      console.log('マスターデータのメモリを解放中...');
      for (const [cardId, masterData] of masterDataMapRef.current.entries()) {
        try {
          if (masterData.keypoints) {
            masterData.keypoints.delete();
          }
          if (masterData.descriptors) {
            masterData.descriptors.delete();
          }
        } catch (error) {
          console.warn(`${cardId}のメモリ解放エラー:`, error);
        }
      }
      masterDataMapRef.current.clear();
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
    videoRef,
    canvasRef,
    captureImage,
    deleteImage,
    addToBlacklist,
  };
}

