import React from "react"


interface RenderHTMLProps {
  html: string | React.ReactNode;
  className?: string
}


const RenderHTML = ({ html, className = "" }: RenderHTMLProps) => {
  if (typeof html === "string") {
    return <div className={className + ""} dangerouslySetInnerHTML={{ __html: html || "" }} />
  } else {
    return html
  }
}

export default RenderHTML