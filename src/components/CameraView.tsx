'use client';

import { useTarotReader } from '@/src/hooks/useTarotReader';

export function CameraView() {
  const {
    isCvLoaded,
    isAnalyzing,
    hasSavedImage,
    candidates,
    videoRef,
    canvasRef,
    captureImage,
    deleteImage,
    addToBlacklist,
  } = useTarotReader();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      {/* ステータス表示 */}
      {!isCvLoaded && (
        <div className="absolute top-4 left-4 bg-yellow-500 text-white px-4 py-2 rounded z-10">
          OpenCV.jsをロード中...
        </div>
      )}
      {isAnalyzing && (
        <div className="absolute top-4 left-4 bg-blue-500 text-white px-4 py-2 rounded z-10">
          画像を解析中...
        </div>
      )}

      {/* Canvasプレビュー */}
      <div className="relative w-full max-w-2xl mb-4">
        <canvas
          ref={canvasRef}
          className="w-full h-auto bg-black rounded-lg"
          style={{ display: 'block' }}
        />
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="hidden"
        />
      </div>

      {/* 操作ボタン */}
      <div className="flex gap-4 mb-6">
        {!hasSavedImage ? (
          <button
            onClick={captureImage}
            disabled={!isCvLoaded}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            画像を撮影
          </button>
        ) : (
          <button
            onClick={deleteImage}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            削除して戻る
          </button>
        )}
      </div>

      {/* 候補一覧 */}
      {hasSavedImage && candidates.length > 0 && (
        <div className="w-full max-w-2xl">
          <h2 className="text-white text-lg font-semibold mb-4 text-center">
            解析結果（上位3件）
          </h2>
          <div className="flex flex-col gap-2">
            {candidates.slice(0, 3).map((candidate, index) => (
              <div
                key={`${candidate.cardName}-${index}`}
                className="flex items-center justify-between bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium">{candidate.cardName}</span>
                  <span className="text-blue-400 text-sm font-semibold">
                    {candidate.matchCount} matches
                  </span>
                </div>
                <button
                  onClick={() => addToBlacklist(candidate.cardName)}
                  className="ml-4 w-8 h-8 flex items-center justify-center bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                  aria-label={`${candidate.cardName}を除外`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasSavedImage && candidates.length === 0 && (
        <div className="text-white text-center">
          <p>すべての候補が除外されました。</p>
        </div>
      )}
    </div>
  );
}

