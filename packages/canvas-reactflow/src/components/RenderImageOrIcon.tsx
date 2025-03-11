import React, { CSSProperties } from "react";


const RenderIconOrImg = ({ icon, style, className = '' }: { icon: React.ReactNode, style?: CSSProperties, className?: string }) => {
  console.log("RenderIconOrImg", icon);
  if (typeof icon === "string") {
    if (icon.startsWith("http")) {
      return (
        <img
          src={icon}
          width={16}
          height={16}
          style={style}
          className={`bg-center bg-no-repeat border-none bg-cover ${className}`}
          alt="icon"
        />
      );
    } else {
      return <span className={className}>{icon}</span>;
    }
  }
  else if (typeof icon === "function") {
    return <span className={className}>{React.createElement(icon)}</span>;
  }
  else {
    return <span className={className}>{icon}</span>;
  }
};

export default RenderIconOrImg;