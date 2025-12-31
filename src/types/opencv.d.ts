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
      COLOR_GRAY2RGBA: number;
      COLOR_BGR2RGBA: number;
      addWeighted: (src1: any, alpha: number, src2: any, beta: number, gamma: number, dst: any) => void;
      bitwise_not: (src: any, dst: any) => void;
      waitKey: (delay: number) => number;
      onRuntimeInitialized: () => void;
      ORB: any;
      ORB_create?: (maxFeatures?: number) => any;
      BFMatcher: any;
      BFMatcher_create?: (normType?: number, crossCheck?: boolean) => any;
      NORM_HAMMING: number;
      NORM_HAMMING2: number;
      KeyPointVector: {
        new (): any;
      };
      DMatchVector: {
        new (): any;
      };
      Canny: (image: any, edges: any, threshold1: number, threshold2: number, apertureSize?: number, L2gradient?: boolean) => void;
      threshold: (src: any, dst: any, thresh: number, maxval: number, type: number) => number;
      findContours: (image: any, contours: any, hierarchy: any, mode: number, method: number, offset?: any) => void;
      dilate: (src: any, dst: any, kernel: any, anchor?: any, iterations?: number, borderType?: number, borderValue?: any) => void;
      getStructuringElement: (shape: number, ksize: any, anchor?: any) => any;
      MORPH_RECT: number;
      Size: {
        new (width: number, height: number): any;
      };
      Point: {
        new (x?: number, y?: number): any;
      };
      BORDER_CONSTANT: number;
      morphologyDefaultBorderValue: () => any;
      contourArea: (contour: any, oriented?: boolean) => number;
      approxPolyDP: (curve: any, approxCurve: any, epsilon: number, closed: boolean) => void;
      arcLength: (curve: any, closed: boolean) => number;
      ContourVector: {
        new (): any;
      };
      MatVector: {
        new (): any;
      };
      PointVector: {
        new (): any;
      };
      RETR_EXTERNAL: number;
      RETR_LIST: number;
      RETR_CCOMP: number;
      RETR_TREE: number;
      CHAIN_APPROX_SIMPLE: number;
      CHAIN_APPROX_NONE: number;
      THRESH_BINARY: number;
      THRESH_BINARY_INV: number;
      THRESH_TRUNC: number;
      THRESH_TOZERO: number;
      THRESH_TOZERO_INV: number;
      THRESH_OTSU: number;
      matFromArray: (rows: number, cols: number, type: number, array: number[]) => any;
      CV_32FC2: number;
      getPerspectiveTransform: (src: any, dst: any) => any;
      warpPerspective: (src: any, dst: any, M: any, dsize: any, flags?: number, borderMode?: number, borderValue?: any) => void;
    };
  }
  
  interface Mat {
    convertTo: (dst: any, type: number, alpha?: number, beta?: number) => void;
    delete: () => void;
    rows: number;
    cols: number;
    data32S: Int32Array;
    data32F: Float32Array;
    data8U: Uint8Array;
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
  
  interface ContourVector {
    size: () => number;
    get: (index: number) => any;
    push_back: (contour: any) => void;
    delete: () => void;
  }
  
  interface MatVector {
    size: () => number;
    get: (index: number) => any;
    push_back: (mat: any) => void;
    delete: () => void;
  }
  
  interface PointVector {
    size: () => number;
    get: (index: number) => { x: number; y: number };
    push_back: (point: any) => void;
    delete: () => void;
  }
}

export {};

