import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import TextInputApp from "../../../../components/common/TextInputApp";
import TextAreaApp from "../../../../components/common/TextAreaApp";
import SelectorFromApp from "../../../../components/common/SelectorFromApp";
import ButtonPrimaryApp from "../../../../components/common/ButtonPrimaryApp";
import ButtonTextApp from "../../../../components/common/ButtonTextApp";
import { DATA_ORIGIN_TYPE, DataOriginType, urlIsYouTube, readYouTubeTitle, readYouTubeDescription } from "../../../types/origin";
import {
  DATA_MANIPULATION_TYPE,
  DataManipulationType,
} from "../../../types/manipulation";
import {
  dataManipulationVariants as defaultDataManipulationVariants,
  BooleanMatrix,
  getValidDataManipulations,
} from "../../../types/dataManipulationVariants";

export interface CreateNewCardBasicFormProps {
  newTitle: string;
  onChangeTitle: (title: string) => void;
  newDescription: string;
  onChangeDescription: (description: string) => void;
  originUrl?: string;
  onChangeOriginUrl?: (url: string) => void;
  dataOriginName?: DataOriginType;
  onChangeDataOriginName?: (origin: DataOriginType) => void;
  dataManipulationName?: DataManipulationType;
  onChangeDataManipulationName?: (manipulation: DataManipulationType) => void;
  dataManipulationVariants?: BooleanMatrix;
  onCreateFirst: (originName?: DataOriginType, manipulationName?: DataManipulationType, originUrl?: string) => void;
  onCreateLast: (originName?: DataOriginType, manipulationName?: DataManipulationType, originUrl?: string) => void;
  onClose?: () => void;
  primaryColor?: string;
  formHeaderTitle?: string;
  testID?: string;
}

export const CreateNewCardBasicForm: React.FC<CreateNewCardBasicFormProps> = ({
  newTitle,
  onChangeTitle,
  newDescription,
  onChangeDescription,
  originUrl,
  onChangeOriginUrl,
  dataOriginName = DATA_ORIGIN_TYPE.youtube,
  onChangeDataOriginName,
  dataManipulationName = DATA_MANIPULATION_TYPE.YOUTUBE_TO_GOOGLE_DRIVE,
  onChangeDataManipulationName,
  dataManipulationVariants = defaultDataManipulationVariants,
  onCreateFirst,
  onCreateLast,
  onClose,
  primaryColor = "#6200ee",
  formHeaderTitle = "Create New Card",
  testID = "createNewCardForm",
}) => {
  const [titleTouched, setTitleTouched] = useState(false);
  const [urlTouched, setUrlTouched] = useState(false);
  const [internalOriginUrl, setInternalOriginUrl] = useState(originUrl || "");
  const currentOriginUrl = originUrl !== undefined ? originUrl : internalOriginUrl;

  // URL Validation Helper
  const isValidUrl = (url: string) => {
    if (!url || !url.trim()) return true;
    try {
      const parsed = new URL(url.trim());
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const isUrlBad = Boolean(currentOriginUrl && currentOriginUrl.trim() && !isValidUrl(currentOriginUrl));

  // Error check function for Origin URL input
  const originUrlErrorCheck = (text: string) => {
    if (text && text.trim() && !isValidUrl(text)) {
      return "Invalid URL (must start with http:// or https://)";
    }
    return null;
  };

  // Error check function for Title input
  const titleErrorCheck = (text: string) => {
    if (titleTouched && !text.trim()) {
      return "Title is required";
    }
    return null;
  };

  // Get allowed manipulation options for current dataOriginName from dataManipulationVariants in posts.ts
  const allowedManipulations: DataManipulationType[] = useMemo(() => {
    const valid = getValidDataManipulations(dataOriginName, dataManipulationVariants);
    return valid.length > 0 ? valid : Object.values(DATA_MANIPULATION_TYPE);
  }, [dataOriginName, dataManipulationVariants]);

  // Handle URL input changes with urlIsYouTube check & readYouTubeTitle auto-title
  const handleOriginUrlChange = async (text: string) => {
    if (onChangeOriginUrl) {
      onChangeOriginUrl(text);
    } else {
      setInternalOriginUrl(text);
    }

    if (urlIsYouTube(text)) {
      // 1) Set data origin automatically to YouTube
      if (onChangeDataOriginName) {
        onChangeDataOriginName(DATA_ORIGIN_TYPE.youtube);
      }

      // 2) Check data manipulation: if good for YouTube, do nothing; else set first possible option for YouTube
      const validForYoutube = getValidDataManipulations(DATA_ORIGIN_TYPE.youtube, dataManipulationVariants);
      if (validForYoutube.length > 0 && !validForYoutube.includes(dataManipulationName)) {
        if (onChangeDataManipulationName) {
          onChangeDataManipulationName(validForYoutube[0]);
        }
      }

      // 3) Run readYouTubeTitle and set Title = readYouTubeTitle
      const fetchedTitle = await readYouTubeTitle(text);
      if (fetchedTitle) {
        onChangeTitle(fetchedTitle);
        setTitleTouched(false);
      }

      // 4) Run readYouTubeDescription and set Description = readYouTubeDescription
      const fetchedDesc = await readYouTubeDescription(text);
      if (fetchedDesc) {
        onChangeDescription(fetchedDesc);
      }
    }
  };

  // Handle Data Origin selection change: update origin and adjust manipulation if current choice is invalid
  const handleOriginChange = (newOrigin: DataOriginType) => {
    if (onChangeDataOriginName) {
      onChangeDataOriginName(newOrigin);
    }
    const validOptions = getValidDataManipulations(newOrigin, dataManipulationVariants);
    const optionsToUse = validOptions.length > 0 ? validOptions : Object.values(DATA_MANIPULATION_TYPE);
    if (optionsToUse.length > 0 && !optionsToUse.includes(dataManipulationName)) {
      if (onChangeDataManipulationName) {
        onChangeDataManipulationName(optionsToUse[0]);
      }
    }
  };

  // Ensure dataManipulationName stays in sync with allowedManipulations when dataOriginName changes externally
  useEffect(() => {
    if (allowedManipulations.length > 0 && !allowedManipulations.includes(dataManipulationName)) {
      if (onChangeDataManipulationName) {
        onChangeDataManipulationName(allowedManipulations[0]);
      }
    }
  }, [dataOriginName, allowedManipulations, dataManipulationName, onChangeDataManipulationName]);

  const handleCreateFirst = () => {
    if (isUrlBad) return;
    if (!newTitle.trim()) {
      setTitleTouched(true);
      return;
    }
    onCreateFirst(dataOriginName, dataManipulationName, currentOriginUrl);
  };

  const handleCreateLast = () => {
    if (isUrlBad) return;
    if (!newTitle.trim()) {
      setTitleTouched(true);
      return;
    }
    onCreateLast(dataOriginName, dataManipulationName, currentOriginUrl);
  };

  const theme = useTheme();

  return (
    <Card testID={testID} style={[styles.createCard, { backgroundColor: theme.colors.surface }]} mode="elevated">
      <Card.Content>
        <Text variant="titleMedium" style={[styles.formHeader, { color: theme.colors.onSurface }]}>
          {formHeaderTitle}
        </Text>

        {/* Origin URL Input with autoFocus and errorCheck */}
        <TextInputApp
          label="Origin URL"
          value={currentOriginUrl}
          onChangeText={(text: string) => {
            setUrlTouched(true);
            handleOriginUrlChange(text);
          }}
          placeholder="Enter URL (e.g., https://youtu.be/...)"
          autoFocus={true}
          errorCheck={originUrlErrorCheck}
          testID="originUrlInput"
        />

        {/* Title Input with errorCheck prop */}
        <TextInputApp
          label="Title"
          value={newTitle}
          onChangeText={(text: string) => {
            onChangeTitle(text);
            if (titleTouched && text.trim()) {
              setTitleTouched(false);
            }
          }}
          placeholder="Enter post title"
          errorCheck={titleErrorCheck}
        />

        <TextAreaApp
          label="Description"
          value={newDescription}
          onChangeText={onChangeDescription}
          placeholder="Enter post description"
          numberOfLines={2}
        />

        {/* Select Data Origin (disabled if urlIsYouTube is true and Origin type is not empty) */}
        <SelectorFromApp<DataOriginType>
          label="Origin type"
          value={dataOriginName}
          onValueChange={handleOriginChange}
          options={DATA_ORIGIN_TYPE}
          disabled={urlIsYouTube(currentOriginUrl) && Boolean(dataOriginName && dataOriginName.trim())}
          testID="dataOriginSelector"
        />

        {/* Select Data Manipulation (limited by dataManipulationVariants) */}
        <SelectorFromApp<DataManipulationType>
          label="Data Manipulation"
          value={dataManipulationName}
          onValueChange={(val) => onChangeDataManipulationName && onChangeDataManipulationName(val)}
          options={allowedManipulations}
          testID="dataManipulationSelector"
        />

        {/* Action Buttons: Add first, Add last, and right-justified Close icon */}
        <View style={styles.buttonRow}>
          <div title="Add new card as the first item">
            <ButtonPrimaryApp
              title="Add first"
              onPress={handleCreateFirst}
              disabled={isUrlBad}
              icon={() => <MaterialIcons name="add-circle-outline" size={22} color="#ffffff" />}
            />
          </div>

          <div title="Add new card as the last item and scroll to it">
            <ButtonTextApp
              title="Add last"
              onPress={handleCreateLast}
              disabled={isUrlBad}
              icon={() => <MaterialIcons name="playlist-add" size={22} color={primaryColor} />}
            />
          </div>

          {onClose && (
            <div title="Close form" style={{ marginLeft: "auto" }}>
              <TouchableOpacity
                testID="closeFormButton"
                activeOpacity={0.7}
                onPress={onClose}
                style={{ padding: 4 }}
                accessibilityLabel="Close Form"
              >
                <MaterialIcons name="close" size={24} color={primaryColor} />
              </TouchableOpacity>
            </div>
          )}
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  createCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginVertical: 6,
    elevation: 4,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  formHeader: {
    marginBottom: 4,
    color: "#333",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
    alignItems: "center",
  },
});

export default CreateNewCardBasicForm;
