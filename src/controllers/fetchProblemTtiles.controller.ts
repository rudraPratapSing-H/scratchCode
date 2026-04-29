// write a controller bullitprint


import express from 'express';
type Request = express.Request;
type Response = express.Response;


import { fetchProblemTitles } from '../services/fetchProblemTitles.services.ts';
export const searchProblems_andIds = async (req: Request, res: Response) => {
    try{
        console.log("fetching problem titles and ids..."); 
        const returnObject = await fetchProblemTitles();
        console.log("fetched problem titles and ids: ", returnObject);
        res.status(200).json({
            success: true,
            data: returnObject
        });
    }
    catch(error: any){
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to fetch problem titles and ids.'
        });
    }   
};