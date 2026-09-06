// 应用导航配置

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import {
  HomeScreen,
  SearchScreen,
  CameraScreen,
  ImagePickerScreen,
  RecognitionScreen,
  ResultScreen,
  AnimalDetailScreen,
  TaxonomyTreeScreen,
} from '../screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen 
          name="Camera" 
          component={CameraScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen 
          name="ImagePicker" 
          component={ImagePickerScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen 
          name="Recognition" 
          component={RecognitionScreen}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen name="Result" component={ResultScreen} />
        <Stack.Screen name="AnimalDetail" component={AnimalDetailScreen} />
        <Stack.Screen name="TaxonomyTree" component={TaxonomyTreeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
