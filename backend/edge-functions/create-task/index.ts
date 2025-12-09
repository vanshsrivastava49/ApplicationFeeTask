// LearnLynk Tech Test - Task 3: Edge Function create-task

// Deno + Supabase Edge Functions style
// Docs reference: https://supabase.com/docs/guides/functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type CreateTaskPayload = {
  application_id: string;
  task_type: string;
  due_at: string;
};

const VALID_TYPES = ["call", "email", "review"];

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as Partial<CreateTaskPayload>;
    const { application_id, task_type, due_at } = body;

    // TODO: validate application_id, task_type, due_at
    // - check task_type in VALID_TYPES
    // - parse due_at and ensure it's in the future
    if(!application_id||!task_type||!due_at){
      return new Response(
        JSON.stringify({
          error:"application_id, task_type, and due_at are required",
        }),
        {
          status:400,
          headers:{"Content-Type":"application/json" },
        },
      );
    }
    if (!VALID_TYPES.includes(task_type as (typeof VALID_TYPES)[number])) {
      return new Response(
        JSON.stringify({
          error:"Invalid task_type. Ensure it is one from these: call, email, review",
        }),
        {
          status:400,
          headers:{"Content-Type":"application/json" },
        },
      );
    }
    const dueDate=new Date(due_at);
    if (Number.isNaN(dueDate.getTime())) {
      return new Response(
        JSON.stringify({
          error:"Invalid due_at. Enter valid ISO datetime string",
        }),
        {
          status:400,
          headers:{ "Content-Type":"application/json" },
        },
      );
    }
    const now=new Date();
    if(dueDate<=now){
      return new Response(
        JSON.stringify({error:"ensure due_at in the future" }),
        {
          status:400,
          headers:{"Content-Type":"application/json" },
        },
      );
    }

    // TODO: insert into tasks table using supabase client

    // Example:
    // const { data, error } = await supabase
    //   .from("tasks")
    //   .insert({ ... })
    //   .select()
    //   .single();

    // TODO: handle error and return appropriate status code

    // Example successful response:
    // return new Response(JSON.stringify({ success: true, task_id: data.id }), {
    //   status: 200,
    //   headers: { "Content-Type": "application/json" },
    // });
    const {data, error }=await supabase.from("tasks").insert({
        application_id,
        type: task_type,
        due_at,
        status: "open",
      })
      .select("id, application_id, type, due_at, status, created_at")
      .single();
      
    if(error||!data){
      console.error("Error inserting task:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create task" }),
        {
          status:500,
          headers:{"Content-Type":"application/json" },
        },
      );
    }

    try{
      const channel=supabase.channel("tasks");
      const resp=await channel.send({
        type: "broadcast",
        event: "task.created",
        payload:{
          task_id: data.id,
          application_id: data.application_id,
          type: data.type,
          status: data.status,
          due_at: data.due_at,
          created_at: data.created_at,
        },
      });
      console.log("Broadcast result:", resp);
      supabase.removeChannel(channel);
    }catch(broadcastErr){
      console.error("Failed to broadcast task.created:", broadcastErr);
    }
    return new Response(JSON.stringify({ success: true, task_id: data.id }),{
      status: 200,
      headers:{"Content-Type": "application/json"},
    });
  } catch(err){
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }),{
      status: 500,
      headers:{"Content-Type": "application/json"},
    });
  }
});