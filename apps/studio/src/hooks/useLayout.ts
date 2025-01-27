import { useLayoutStore } from "@/store/layoutStore";


const useLayout = () => {

  const leftSidebar = useLayoutStore((state) => state.leftSidebar);
  const rightSidebar = useLayoutStore((state) => state.rightSidebar);

  const setLeftSidebar = useLayoutStore((state) => state.setLeftSidebar);
  const setRightSidebar = useLayoutStore((state) => state.setRightSidebar);

  const closeLeftSidebar = useLayoutStore((state) => state.closeLeftSidebar);
  const closeRightSidebar = useLayoutStore((state) => state.closeRightSidebar);

  return {
    leftSidebar,
    rightSidebar,
    setLeftSidebar,
    setRightSidebar,
    closeLeftSidebar,
    closeRightSidebar,
  };
};

export default useLayout;