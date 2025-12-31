/* eslint-disable @typescript-eslint/no-explicit-any */
// OpenCV.js型定義
declare global {
  interface Window {
    cv: {
      Mat: {
        new (): any;
        new (rows: number, cols: number, type: number): any;
        new (rows: number, cols: number, type: number, data: any): any;
      };
      imread: (element: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) => any;
      imshow: (canvasId: string | HTMLCanvasElement, mat: any) => void;
      cvtColor: (src: any, dst: any, code: number, dstCn?: number) => void;
      COLOR_RGBA2GRAY: number;
      addWeighted: (src1: any, alpha: number, src2: any, beta: number, gamma: number, dst: any) => void;
      bitwise_not: (src: any, dst: any) => void;
      waitKey: (delay: number) => number;
      onRuntimeInitialized: () => void;
    };
  }
  
  interface Mat {
    convertTo: (dst: any, type: number, alpha?: number, beta?: number) => void;
    delete: () => void;
  }
}

export {};

