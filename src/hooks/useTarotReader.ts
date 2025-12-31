'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface MasterData {
  keypoints: any;
  descriptors: any;
}

interface UseTarotReaderReturn {
  isCvLoaded: boolean;
  isAnalyzing: boolean;
  hasSavedImage: boolean;
  candidates: string[];
  blacklist: string[];
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  captureImage: () => void;
  deleteImage: () => void;
  addToBlacklist: (card: string) => void;
}

const STORAGE_KEY = 'tarot-captured-image';

export function useTarotReader(): UseTarotReaderReturn {
  const [isCvLoaded, setIsCvLoaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasSavedImage, setHasSavedImage] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const savedImageRef = useRef<string | null>(null);
  const savedImageElementRef = useRef<HTMLImageElement | null>(null);
  const masterDataRef = useRef<Record<string, MasterData>>({});

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

  // マスターデータのロードとORB特徴量計算
  useEffect(() => {
    if (!isCvLoaded) return;

    const loadMasterData = async (cardName: string, imagePath: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const src = window.cv.imread(img);
            const gray = new window.cv.Mat();
            window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

            const orb = window.cv.ORB.create(500);
            const keypoints = new window.cv.KeyPointVector();
            const descriptors = new window.cv.Mat();

            orb.detectAndCompute(gray, new window.cv.Mat(), keypoints, descriptors);

            masterDataRef.current[cardName] = {
              keypoints,
              descriptors,
            };

            console.log(`${cardName}: 特徴点 ${keypoints.size()} 個、記述子サイズ ${descriptors.rows}x${descriptors.cols}`);

            // メモリ解放（keypointsとdescriptorsは保持するため削除しない）
            src.delete();
            gray.delete();
            orb.delete();

            resolve();
          } catch (error) {
            console.error(`${cardName}の特徴量計算エラー:`, error);
            reject(error);
          }
        };
        img.onerror = () => {
          console.error(`${cardName}の画像ロードエラー: ${imagePath}`);
          reject(new Error(`Failed to load ${imagePath}`));
        };
        img.src = imagePath;
      });
    };

    const initializeMasterData = async () => {
      try {
        await loadMasterData('THE SUN', '/master/SUN.jpg');
        await loadMasterData('THE FOOL', '/master/FOOL.jpg');
        console.log('マスターデータの初期化が完了しました');
      } catch (error) {
        console.error('マスターデータの初期化エラー:', error);
      }
    };

    initializeMasterData();
  }, [isCvLoaded]);

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
        
        // メモリ解放
        src.delete();
        gray.delete();
        contrast.delete();
      } catch (error) {
        // OpenCV処理が失敗した場合は通常描画
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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
    if (!isCvLoaded || Object.keys(masterDataRef.current).length === 0) {
      console.warn('OpenCVがロードされていないか、マスターデータが初期化されていません');
      return;
    }

    setIsAnalyzing(true);

    try {
      // 撮影画像の特徴量を抽出
      const src = window.cv.imread(imageElement);
      const gray = new window.cv.Mat();
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

      const orb = window.cv.ORB.create(500);
      const keypoints = new window.cv.KeyPointVector();
      const descriptors = new window.cv.Mat();

      orb.detectAndCompute(gray, new window.cv.Mat(), keypoints, descriptors);

      // BFMatcherでマッチング
      const matcher = window.cv.BFMatcher.create(window.cv.NORM_HAMMING, false);
      const matchResults: Record<string, number> = {};

      for (const [cardName, master] of Object.entries(masterDataRef.current)) {
        const matches = new window.cv.DMatchVector();
        matcher.match(descriptors, master.descriptors, matches);

        // Good Matchesを計算（距離が小さいものをフィルタリング）
        const goodMatches: any[] = [];
        const matchCount = matches.size();
        
        for (let i = 0; i < matchCount; i++) {
          const match = matches.get(i);
          if (match.distance < 50) { // 閾値は調整可能
            goodMatches.push(match);
          }
        }

        const goodMatchCount = goodMatches.length;
        matchResults[cardName] = goodMatchCount;
        
        console.log(`${cardName}: 総マッチ数 ${matchCount}, Good Matches ${goodMatchCount}`);

        matches.delete();
      }

      // スコアが高い順にソート
      const sortedCards = Object.entries(matchResults)
        .sort(([, a], [, b]) => b - a)
        .map(([cardName]) => cardName);

      console.log('マッチング結果:', matchResults);
      console.log('候補順位:', sortedCards);

      setCandidates(sortedCards);

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
  }, [isCvLoaded]);

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

  // フィルタリングされた候補
  const filteredCandidates = candidates.filter((c) => !blacklist.includes(c));

  return {
    isCvLoaded,
    isAnalyzing,
    hasSavedImage,
    candidates: filteredCandidates,
    blacklist,
    videoRef,
    canvasRef,
    captureImage,
    deleteImage,
    addToBlacklist,
  };
}

