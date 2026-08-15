"use client";
import { motion } from "motion/react";
export function MotionIn({children,className}:{children:React.ReactNode;className?:string}){return <motion.div className={className} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.24,ease:"easeOut"}}>{children}</motion.div>}
