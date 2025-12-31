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
      ORB: {
        new (maxFeatures?: number): any;
        create: (maxFeatures?: number) => any;
      };
      ORB_create: (maxFeatures?: number) => any;
      BFMatcher: {
        new (normType?: number, crossCheck?: boolean): any;
        create: (normType?: number, crossCheck?: boolean) => any;
      };
      BFMatcher_create: (normType?: number, crossCheck?: boolean) => any;
      NORM_HAMMING: number;
      NORM_HAMMING2: number;
      KeyPointVector: {
        new (): any;
      };
      DMatchVector: {
        new (): any;
      };
    };
  }
  
  interface Mat {
    convertTo: (dst: any, type: number, alpha?: number, beta?: number) => void;
    delete: () => void;
    rows: number;
    cols: number;
  }
  
  interface ORB {
    detectAndCompute: (image: any, mask: any, keypoints: any, descriptors: any) => void;
    delete: () => void;
  }
  
  interface BFMatcher {
    match: (descriptors1: any, descriptors2: any, matches: any) => void;
    knnMatch: (descriptors1: any, descriptors2: any, k: number, matches: any, mask?: any) => void;
    delete: () => void;
  }
  
  interface KeyPointVector {
    size: () => number;
    get: (index: number) => any;
    push_back: (keypoint: any) => void;
    delete: () => void;
  }
  
  interface DMatchVector {
    size: () => number;
    get: (index: number) => any;
    push_back: (match: any) => void;
    delete: () => void;
  }
  
  interface KeyPoint {
    pt: { x: number; y: number };
    size: number;
    angle: number;
    response: number;
    octave: number;
    class_id: number;
  }
  
  interface DMatch {
    queryIdx: number;
    trainIdx: number;
    imgIdx: number;
    distance: number;
  }
}

export {};

