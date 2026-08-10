import {DATA_ORIGIN_TYPE, DataOriginType} from "./origin";
import {DATA_MANIPULATION_TYPE, DataManipulationType} from "./manipulation";

export type BooleanCell = 0 | 1;

export type BooleanMatrix = Record<
    DataOriginType,
    Record<DataManipulationType, BooleanCell>
>;

/**
 * Creates and initializes a boolean matrix using origin and manipulation type objects.
 */
export function createBooleanMatrix(
    initialValue: BooleanCell = 0,
    origins: Record<string, string> = DATA_ORIGIN_TYPE,
    manipulations: Record<string, string> = DATA_MANIPULATION_TYPE
): BooleanMatrix {
    const matrix = {} as BooleanMatrix;

    // Cast Object.values to the specific union types instead of adding :string to the for-loop variable
    for (const origin of Object.values(origins) as DataOriginType[]) {
        matrix[origin] = {} as Record<DataManipulationType, BooleanCell>;
        for (const manipulation of Object.values(manipulations) as DataManipulationType[]) {
            matrix[origin][manipulation] = initialValue;
        }
    }

    return matrix;
}

// Safely initialized matrix
export const dataManipulationVariants: BooleanMatrix = createBooleanMatrix(
    0,
    DATA_ORIGIN_TYPE,
    DATA_MANIPULATION_TYPE
);

// ✅ Perfectly type-safe access and assignment:
dataManipulationVariants[DATA_ORIGIN_TYPE.youtube][DATA_MANIPULATION_TYPE.YOUTUBE_TO_DOWNLOAD] = 1;
dataManipulationVariants[DATA_ORIGIN_TYPE.youtube][DATA_MANIPULATION_TYPE.YOUTUBE_TO_GOOGLE_DRIVE] = 1;

dataManipulationVariants[DATA_ORIGIN_TYPE.msword][DATA_MANIPULATION_TYPE.FILE_TO_GOOGLE_DRIVE] = 1;
dataManipulationVariants[DATA_ORIGIN_TYPE.msexcel][DATA_MANIPULATION_TYPE.FILE_TO_GOOGLE_DRIVE] = 1;
dataManipulationVariants[DATA_ORIGIN_TYPE.webpage][DATA_MANIPULATION_TYPE.WEB_PAGE_TO_GOOGLE_DRIVE] = 1;

/**
 * Returns array of valid DataManipulationType options for a given DataOriginType
 * based on the dataManipulationVariants boolean matrix.
 */
export function getValidDataManipulations(
    origin: DataOriginType,
    matrix: BooleanMatrix = dataManipulationVariants
): DataManipulationType[] {
    if (!origin || !matrix[origin]) return [];
    return (Object.keys(matrix[origin]) as DataManipulationType[]).filter(
        (manipulation) => matrix[origin][manipulation] === 1
    );
}

