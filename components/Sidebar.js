import React from "react";
import { Button } from "@nextui-org/react";

const Sidebar = ({ speakText, caesareanSectionInfo, beforeHospitalInfo, dayOfOperationInfo, 
  afterOperationInfo, generalAdviceInfo }) => {
  
  return (
    <div className="flex flex-col gap-2 pr-4 items-start justify-start">
      <Button
        auto
        style={{ backgroundColor: '#41C5D1', color: 'white' }}
        onPress={() => speakText(caesareanSectionInfo)}
      >
        About C-Section
      </Button>
      <Button
        auto
        style={{ backgroundColor: '#41C5D1', color: 'white' }}
        onPress={() => speakText(beforeHospitalInfo)}
      >
        Before You Come
      </Button>
      <Button
        auto
        style={{ backgroundColor: '#41C5D1', color: 'white' }}
        onPress={() => speakText(dayOfOperationInfo)}
      >
        Day of Operation
      </Button>
      <Button
        auto
        style={{ backgroundColor: '#41C5D1', color: 'white' }}
        onPress={() => speakText(afterOperationInfo)}
      >
        After Operation
      </Button>
      <Button
        auto
        style={{ backgroundColor: '#41C5D1', color: 'white' }}
        onPress={() => speakText(generalAdviceInfo)}
      >
        General Advice
      </Button>


    </div>
  );
};

export default Sidebar;
