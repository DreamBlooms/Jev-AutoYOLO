import { render } from "@/utils/test-utils";
import {describe, it, expect, vi} from "vitest";
import { Sidebar } from "./index";

vi.mock("@/store/useAppStore", () => ({
  useAppStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      isTraining: false,
      setIsTraining: vi.fn(),
      files: [],
      categories: [],
      appMode: "annotate",
      useSam2: false,
      useSam3: false,
      useVlm: false,
      setUseVlm: vi.fn(),
      setUseSam3: vi.fn(),
      annotationOnly: false,
      gpuAvailable: false,
      devicePreference: "auto",
      setDevicePreference: vi.fn(),
      activeDevice: "cpu",
      setActiveDevice: vi.fn(),
      availableDevices: ["cpu"],
      setAvailableDevices: vi.fn(),
      rocm: false,
      setRocm: vi.fn(),
      gpuName: "",
      setGpuName: vi.fn(),
      extraState: "",
      setExtraState: vi.fn(),
      extraInstructions: "",
      setExtraInstructions: vi.fn(),
      categoryInstructions: {},
      setCategoryInstructions: vi.fn(),
      validateVideoId: null,
      batchResults: [],
      result: null,
      setResult: vi.fn(),
      setPreviewUrl: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

describe("Sidebar", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    const mockProps = {
      recentCategories: [],
      handleFiles: vi.fn(),
      handleDetect: vi.fn(),
      handleSelectHistory: vi.fn(),
      handleSelectKeyframe: vi.fn(),
      loading: false,
      batchProgress: { current: 0, total: 0 },
      batchResults: [],
      setBatchResults: vi.fn(),
      cancel: vi.fn(),
      historyQuery: { hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn() },
      allItems: [],
      total: 0,
      result: null,
      setResult: vi.fn(),
    };
    const { container } = render(<Sidebar {...mockProps} />);
    expect(container).toBeTruthy();
  });
});
