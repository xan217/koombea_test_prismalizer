import { useMonaco } from "@monaco-editor/react";
import React, { useEffect, useState } from "react";
import { useDebounce, useLocalStorage } from "react-use";
import useFetch from "use-http";

import FlowView from "~/components/FlowView";
import Layout from "~/components/Layout";
import { fromUrlSafeB64 } from "~/util";
import { ErrorTypes, SchemaError } from "~/util/types";

import { Icon } from "@iconify/react";
import trash from "@iconify/icons-gg/trash";

import { TableColumn, defaultTableColumn } from "~/util/interfaces/tableColumn";
import { Table } from "~/util/interfaces/table";
import { TypeList, ProvidersList } from "~/util/selects";

import type { DMMF } from "@prisma/generator-helper";
import type { editor } from "monaco-editor";

const IndexPage = () => {
  // TODO: multiple save states.
  const [ storedText,   setStoredText ]   = useLocalStorage("prismaliser.text", ``);
  const [ text,         setText ]         = useState(storedText!);
  const [ schemaErrors, setSchemaErrors ] = useState<SchemaError[]>([]);
  const [ dmmf,         setDMMF ]         = useState<DMMF.Datamodel | null>(null);

  const [ dbQuery,      setDBQuery ]      = useState("");
  const [ tableFields,  setTableFields ]  = useState<TableColumn[]>([]);
  const [ step,         setStep]          = useState(0);
  const [ tableName,    setTableName ]    = useState("");
  const [ tableList,    setTableList ]    = useState<Table[]>([]);
  const [ firstStep,    setFirstStep ]    = useState<any>({});

  const { post, response, loading }       = useFetch("/api");
  const monaco                            = useMonaco();

  /**
   * submit
   * 
   * Updated submit function from the old one the have a parameter. For logical sequence and
   * conflicts, the solutions was to pass the string and not read the stored one. This should be
   * chenged to be managed without the parameter
   * 
   * @param dbString 
   */
  const submit = async (dbString: string) => {

    // Adds the head part of the file to be interpreted
    const sendingText = await format(``+
    `datasource db {
      provider = "${firstStep.provider || "postgresql"}"
      url      = env("DATABASE_URL")
    }
    
    generator client {
      provider = "prisma-client-js"
    }

    `+dbString);
    
    // Save the string to be used in the future
    await setStoredText(sendingText);
    const resp = await post({ schema: sendingText });

    // Generate the tables on the viewport
    if (response.ok) {
      setDMMF(resp);
      setSchemaErrors([]);
    } else if (resp.type === ErrorTypes.Prisma) setSchemaErrors(resp.errors);
    else console.error(resp);
  };

  /**
   * format
   * 
   * Updated version of the function to receive the string and return it formatted. An easy
   * way to reutilize the old function to give the correct format to the file to be processed
   */
  const format = async (text: string) => {
    const resp = await post("/format", { schema: text });
    console.log('response', response);
    if (response.ok) setText(resp.formatted);
    return resp.formatted;
  };

  /**
   * setTableNameHelper
   * 
   * Just set the table name
   */
  const setTableNameHelper = (event: any) => {
    setTableName(event.target.value);
  }

  /**
   * handleInputFirstStepChange
   * 
   * Manage the first step of the workflow to save the database type and (shoutld be) the source 
   * of the database. This function should handle the version with the ENV option.
   */
  const handleInputFirstStepChange = (event: any) => {
    setFirstStep({
      [event.target.name]: event.target.value
    });
  }


  /**
   * handleInputChange
   * 
   * Given the event, the function localize the field that is being updated and sets the new value
   * of it. It is a generic function that can be used in order to idetify multiple fields with 
   * just one function call.
   * 
   * Reference (first and accepted answer):
   * https://stackoverflow.com/questions/49362279/react-change-input-value-onchange
   * 
   * @param event input field event
   */
  const handleInputChange = (event: any) => {
    const locator = event.target.name.split("_");
        
    const updatedTableColumn: TableColumn = {
      ...tableFields[locator[1]],
      [locator[0]]: event.target.type !== "checkbox" 
        ? event.target.value 
        : event.target.checked
    };

    const newTableFields = tableFields.map( (column, index) => {
      if(index === Number(locator[1])){
        return updatedTableColumn;
      }
      return column;
    });

    setTableFields(newTableFields);
  }

  /**
   * saveFile
   * 
   * Calls the endpoint (next intern endpoint) to generate the needed file
   * This function save the file in assets/output/output.prisma but not sent it to download
   */
  const saveFile = async () => {
    const resp = await post("/store", { schema: text });
    if (response.ok) alert(resp);
  };

  /**
   * addTableField
   * 
   * Appends a new field to the working table
   */
  const addTableField = () => {
    const newField = {
      ...defaultTableColumn,
      id: tableFields.length
    }
    setTableFields([...tableFields, newField]); 
  }

  /**
   * implementTable
   * 
   * Transforms the data structure in the actual string to be parsed for the visualizer. Reads the data
   * structure and creates step by step the string to be interpreted by the formatter and the visualizer.
   */
  const implementTable = async () => {
    const newTableList = [
      ...tableList,
      {
        tableName,
        tableCols: [
          ...tableFields
        ]
      }
    ]
    setTableList(newTableList);

    let dbString = ``;
    newTableList.forEach(table => {
      dbString += `model ${table.tableName} { \n`;
      console.log(table.tableCols);
      
      table.tableCols.forEach(col => {
        dbString += ``+
        `${col.name} `+
        `${col.type}${col.nullable ? '?' : ''} `+
        `${col.pk ? '@id' : ''} `+
        `${col.longitude! > 0 && col.type === 'String' ? '@db.VarChar('+col.longitude+')' : ''} `+
        `${col.default?.length || col.autoincremental 
          ? '@default('+(col.autoincremental 
            ? 'autoincrement()' 
            : '"'+col.default+'"')
          +')' 
          : ''} `+
        `${col.unique ? '@unique' : ''} \n`;
      });
      dbString += `} \n`;
    });

    setDBQuery(dbString);
    resetTable();
    submit(dbString);    
  }

  /**
   * resetTable
   * 
   * Resets the table to the default values
   */
  const resetTable = () => {
    setTableName("");
    setTableFields([]); 
  }

  /**
   * removeTableField
   * 
   * Looks for the column with the given ID and removes it from the table
   * 
   * @param id row id
   */
  const removeTableField = (id: number) => {
    setTableFields(
      tableFields.filter( tableField => tableField.id !== id )
    )
  }

  /**
   * nextStep
   * 
   * Pass to the next step of the database structure
   */
  const nextStep = () => {
    setStep( step+1 > 2 ? step : step+1 );
  }

  /**
   * prevStep
   * 
   * Pass to the previous step of the database structure
   */
  const prevStep = () => {
    setStep( step-1 < 0 ? step : step-1 );
  }

  /**
   * clearCacheData
   * 
   * Clears the cache data generated by the framework
   * 
   * Reference: 
   * https://stackoverflow.com/questions/68503402/clearing-browser-cache-react-js
   */
  const clearCacheData = () => {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
      });
    });
    console.log('Complete Cache Cleared')
  };

  // Commented debounce to avoid rebgeneration of the submit and only be called when the 
  // button is triggered.
  //useDebounce(submit, 1000, [text]);


  useEffect(() => {
    // Set error squiggles in the editor if we have any
    if (!monaco) return;

    const markers = schemaErrors.map<editor.IMarkerData>((err) => ({
      message: err.reason,
      startLineNumber: Number(err.row),
      endLineNumber: Number(err.row),
      startColumn: 0,
      endColumn: 9999, 
      severity: 8,
    }));
    const [model] = monaco.editor.getModels();

    monaco.editor.setModelMarkers(model, "prismaliser", markers);
  }, [monaco, schemaErrors]);

  

  /**
   * componentDidMount
   * 
   * Effect for didMount Status
   */
  useEffect(() => {
    clearCacheData();
    // Populate state from a shared link if one is present
    const params = new URLSearchParams(location.search);

    if (params.has("code")) {
      const code = params.get("code")!;
      const decoded = fromUrlSafeB64(code);

      setText(decoded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps


  }, []);

  return (
    <Layout>
      <section className="relative flex flex-col items-start border-r-2">
        {/* <EditorView value={text} onChange={(val) => setText(val!)} /> */}

        <div className="stepper">
          {step === 0 && 
          <div className="flex flex-col items-start gap-2 left-4 bottom-4 tab-component">
            <h3>Database info</h3>

            <div className="formContainer">
              <div className="formField">
                <label htmlFor="provider">Type</label>
                <select name="provider" id="provider" onChange={handleInputFirstStepChange}>
                  {ProvidersList.map((provider: string) => (
                    <option value={provider}>{provider}</option>
                  ))}
                </select>
              </div>

              <div className="formField">
                <label htmlFor="url">Source</label>
                <input type="text" name="source" onChange={handleInputFirstStepChange} />
              </div>
            </div>

            <div className="flex flex-row items-end gap-2 bottom-4">
              <button className="steps" onClick={nextStep}>Next Step</button>
            </div>
          </div>}
          {step === 1 && 
          <div className="flex flex-col gap-2 left-4 bottom-4 tab-component">

            <div className="content flex flex-col">

              <h3>Table definition</h3>

              <div className="tableName">
                <h5>Table name: </h5>
                <input type="text" onChange={setTableNameHelper} />
              </div>

              <table className="definitionTable">
                <thead>
                  <tr>
                    <th scope="col"><div><span>Name</span></div></th>
                    <th scope="col"><div><span>Type</span></div></th>
                    <th scope="col"><div><span>Longitude</span></div></th>
                    <th scope="col"><div><span>Default</span></div></th>
                    <th scope="col" className="rotatedText"><div><span>Id</span></div></th>
                    <th scope="col" className="rotatedText"><div><span>Null</span></div></th>
                    <th scope="col" className="rotatedText"><div><span>Autoinc.</span></div></th>
                    <th scope="col" className="rotatedText"><div><span>Unique</span></div></th>
                    <th scope="col"><div><span>Relations</span></div></th>
                    <th scope="col"><div><span>Actions</span></div></th>
                  </tr>
                </thead>
                <tbody>
                  {tableFields.map((field, index) => (
                    <tr >
                      <td>
                        <input name={"name_"+index} type="text" onChange={handleInputChange} />
                      </td>
                      <td>
                        <select name={"type_"+index} id={"type_"+index} onChange={handleInputChange}>
                          <option value="" disabled>Select</option>
                          {TypeList.map( (type: string) => (
                            <option value={type}>{type}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input name={"long_"+index} type="number" min="0" onChange={handleInputChange}/>
                      </td>
                      <td>
                        <input name={"default_"+index} type="text" min="0" onChange={handleInputChange}/>
                      </td>
                      <td>
                        <input type="checkbox" name={"pk_"+index} id={"pk_"+index} onChange={handleInputChange}/>
                      </td>
                      <td>
                        <input type="checkbox" name={"nullable_"+index} id={"nullable_"+index} onChange={handleInputChange}/>
                      </td>
                      <td>
                        <input type="checkbox" name={"autoincremental_"+index} id={"autoincremental_"+index} onChange={handleInputChange} />
                      </td>
                      <td>
                        <input type="checkbox" name={"unique_"+index} id={"unique_"+index} onChange={handleInputChange}/>
                      </td>
                      <td>
                        {/* <input type="checkbox" name={"relations_"+index} id={"relations_"+index} onChange={handleInputChange}/> */}
                      </td>
                      <td>
                        <button onClick={() => removeTableField(field.id)}>
                          <Icon icon={trash}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                </tbody>

              </table>

              <div className="flex flex-row items-start gap-2 left-4 bottom-4 self-center mt-3">
                <button type="button" className="button floating" onClick={addTableField}>
                  Add table field
                </button>
                <button type="button" className="button floating" onClick={implementTable}>
                  Implement table
                </button>
                <button type="button" className="button floating" onClick={resetTable}>
                  Reset table
                </button>
              </div>
            </div>

            <div className="flex flex-row items-end gap-2 left-4 bottom-4 self-end mt-5">
              <button className="steps" onClick={prevStep}>Previous Step</button>
              <button className="steps" onClick={nextStep}>Next Step</button>
            </div>
          </div>}
          {step === 2 && 
          <div className="flex flex-row items-start gap-2 left-4 bottom-4">
            <button type="button" className="button floating" onClick={saveFile}>
              Save File
            </button>

            <div className="flex flex-row items-start gap-2 left-4 bottom-4">              
              <button className="steps" onClick={prevStep}>Previous Step</button>
            </div>
          </div>}

        </div>

        <div className="flex flex-row items-start gap-2 left-4 bottom-4">
          
          {/* crear una tablacon capacidad de expandirse, usar plugin desarrollado para diana */}
          {/* buscar referencia de cómo mysql arma los column */}
          {/*  */}
        </div>

        {loading ? (
          <div className="absolute w-4 h-4 border-2 border-b-0 border-l-0 border-blue-500 rounded-full right-4 bottom-4 animate-spin" />
        ) : null}
      </section>
      <pre className="overflow-auto border-l-2">
        <FlowView dmmf={dmmf}/>
        {/* TODO: add a toggleable "debug" view that shows the raw data? */}
        {/* {JSON.stringify(data, null, 4)} */}
      </pre>
    </Layout>
  );
};

export default IndexPage;
