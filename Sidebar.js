import React from "react";
import { Button } from "@nextui-org/react";

const Sidebar = ({ speakText, caesareanSectionInfo, beforeHospitalInfo, dayOfOperationInfo, 
  afterOperationInfo, generalAdviceInfo }) => {
  
  return (
    <div className="flex flex-col gap-2 pr-4 items-start justify-start">
      <Button
        color="secondary"
        auto
        onPress={() => speakText(caesareanSectionInfo)}
      >
        About C-Section
      </Button>
      <Button
        color="secondary"
        auto
        onPress={() => speakText(beforeHospitalInfo)}
      >
        Before You Come
      </Button>
      <Button
        color="secondary"
        auto
        onPress={() => speakText(dayOfOperationInfo)}
      >
        Day of Operation
      </Button>
      <Button
        color="secondary"
        auto
        onPress={() => speakText(afterOperationInfo)}
      >
        After Operation
      </Button>
      <Button
        color="secondary"
        auto
        onPress={() => speakText(generalAdviceInfo)}
      >
        General Advice
      </Button>


    </div>
  );
};

export default Sidebar;
