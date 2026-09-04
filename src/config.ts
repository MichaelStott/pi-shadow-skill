import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

export const ShadowRepoConfigSchema = z.object({
    skills: z.array(z.string()).optional().default([]),
    readme: z.array(z.string()).optional().default([]),
})

export const ShadowConfigSchema = z.record(z.string(), ShadowRepoConfigSchema);

export type ShadowConfig = z.infer<typeof ShadowConfigSchema>;
export type ShadowRepoConfig = z.infer<typeof ShadowRepoConfigSchema>;

export class ShadowConfigError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'ShadowConfigError';
    }
}

const SHADOW_CONFIG_FILE_PATH = path.join(
    process.env.HOME || process.env.USERPROFILE || '~',
    '.pi',
    'agent',
    'shadow.json'
)

export async function loadShadowConfig(): Promise<ShadowConfig> {
    try {
        const content = await fs.readFile(SHADOW_CONFIG_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(content);
        return ShadowConfigSchema.parse(parsed);
    } catch (error) {
        if (error instanceof z.ZodError) {                
            throw new ShadowConfigError(                    
           `Invalid shadow.json schema:                  
 ${error.message}`,                                      
           'VALIDATION_ERROR'                            
         );                                              
       }                                                 
       if (error instanceof SyntaxError) {               
         throw new ShadowConfigError(                    
           `Failed to parse shadow.json:                 
 ${error.message}`,                                      
           'PARSE_ERROR'                                 
         );                                              
       }                                                 
       if ((error as any).code === 'ENOENT') {           
         throw new ShadowConfigError(                    
           `shadow.json not found at                     
 ${SHADOW_CONFIG_FILE_PATH}`,                                   
           'NOT_FOUND'                                   
         );                                              
       }                                                 
       throw new ShadowConfigError(                      
         `Failed to load shadow.json: ${(error as        
 Error).message}`,                                       
         'IO_ERROR'                                      
       );     
    }
}

export function getRepoConfig(
    // Attempt exact match first
    config: ShadowConfig,
    gitUrl: string
): ShadowRepoConfig | null {
    // Exact match first
    if (config[gitUrl]) {
        return config[gitUrl];
    }

    let strippedUrl = gitUrl.replace(/\.git$/, '');
    if (config[strippedUrl]){
        return config[strippedUrl];
    }

    // Hostname/based matching 
    try {                                               
       const urlObj = new URL(strippedUrl);                   
       const normalized2 =                               
 `${urlObj.hostname}${urlObj.pathname}`;                 
       for (const [key] of Object.entries(config)) {     
         if (key.includes(normalized2)) {                
           return config[key];                           
         }                                               
       }                                                 
     } catch {                                           
       // Not a valid URL, skip hostname matching        
     }   

    return null;
}