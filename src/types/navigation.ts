// 导航相关类型定义

import { Animal, RecognitionResult } from './animal';

export type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  ImagePicker: undefined;
  Recognition: {
    imageUri: string;
    imageBase64?: string;
    imageMimeType?: string;
  };
  Result: {
    result: RecognitionResult;
    imageUri: string;
  };
  AnimalDetail: {
    animal: Animal;
  };
  TaxonomyTree: {
    animal: Animal;
  };
  Search: undefined;
  SearchResult: {
    query: string;
  };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
